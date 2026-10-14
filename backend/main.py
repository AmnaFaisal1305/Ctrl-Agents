"""FastAPI app for the React frontend.

Run from the repo root:  uvicorn backend.main:app --port 8000
There is deliberately no endpoint that sends email; replies are drafts in outbox.json only.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import load_settings
from backend.service import LogTail, NotFound, Service


class NewEmail(BaseModel):
    from_name: str = Field(default="", max_length=200)
    from_email: str = Field(default="", max_length=320)
    subject: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=20000)
    process: bool = True  # run the agent on it right away


class RunRequest(BaseModel):
    only_new: bool = False
    ids: list[str] | None = None  # None = every file in data/inbox


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.svc = Service(load_settings())
    yield


app = FastAPI(title="Student Helpdesk Triage API", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def svc(request: Request) -> Service:
    return request.app.state.svc


@app.get("/api/health")
def health(request: Request) -> dict:
    return svc(request).health()


@app.get("/api/emails")
def list_emails(request: Request) -> list[dict]:
    return svc(request).list_emails()


@app.get("/api/emails/{email_id}")
def email_detail(email_id: str, request: Request) -> dict:
    try:
        return svc(request).detail(email_id)
    except NotFound:
        raise HTTPException(404, "email not found")


@app.post("/api/emails", status_code=201)
def create_email(payload: NewEmail, request: Request) -> dict:
    if not (payload.subject.strip() or payload.body.strip()):
        raise HTTPException(422, "subject or body is required")
    service = svc(request)
    email_id = service.create_email(payload.from_name, payload.from_email, payload.subject, payload.body)
    run = service.start_run([email_id]) if payload.process else None
    return {"id": email_id, "processing": payload.process, "run": run}


@app.post("/api/process", status_code=202)
def process(payload: RunRequest, request: Request) -> dict:
    return svc(request).start_run(payload.ids, payload.only_new)


@app.get("/api/run")
def run_state(request: Request) -> dict:
    return svc(request).state()


@app.get("/api/stats")
def stats(request: Request) -> dict:
    return svc(request).stats()


@app.get("/api/policy")
def policy(request: Request) -> list[dict]:
    return svc(request).policy_view()


@app.get("/api/events")
async def events(request: Request) -> StreamingResponse:
    """Server-Sent Events: `step` (one agent step, same shape as emails/{id}.steps[]) and `run` (progress)."""
    service = svc(request)

    async def stream():
        tail, last, idle = LogTail(service.s.logs), None, 0
        yield "retry: 2000\n\n"
        while not await request.is_disconnected():
            for row in tail.poll():
                yield f"event: step\ndata: {json.dumps(row, ensure_ascii=False)}\n\n"
                idle = 0
            state = service.state()
            if state != last:
                yield f"event: run\ndata: {json.dumps(state)}\n\n"
                last, idle = state, 0
            idle += 1
            if idle % 40 == 0:
                yield ": keepalive\n\n"
            await asyncio.sleep(0.4)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
