"""Gmail access (ARCHITECTURE.md 5.5): read messages into data/inbox and save replies as DRAFTS.

Scopes are readonly + compose only. This module must never deliver mail: nothing here may call a
send endpoint (tests/test_gmail.py greps the code base for that).
"""
import base64
import json
import os
from email.message import EmailMessage
from email.utils import parseaddr, parsedate_to_datetime
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from app.models import OutboxRecord

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
]


def get_service(secrets: Path):
    """OAuth desktop flow; opens a browser only when token.json is missing or unusable.

    Deployed (GMAIL_TOKEN_JSON set): use that token, refresh it in memory, never write a file or open a browser."""
    token_json = os.getenv("GMAIL_TOKEN_JSON")
    if token_json:
        creds = Credentials.from_authorized_user_info(json.loads(token_json), SCOPES)
        if not creds.valid:
            creds.refresh(Request())
        return build("gmail", "v1", credentials=creds, cache_discovery=False)
    token_path = secrets / "token.json"
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(str(secrets / "credentials.json"), SCOPES)
        creds = flow.run_local_server(port=0)
    token_path.write_text(creds.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _b64(data: str) -> str:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")


def _body(payload: dict) -> str:
    """Prefer text/plain; fall back to text/html (the loader strips tags)."""
    found: dict[str, str] = {}

    def walk(part: dict) -> None:
        data = part.get("body", {}).get("data")
        if data and part.get("mimeType") in ("text/plain", "text/html"):
            found.setdefault(part["mimeType"], _b64(data))
        for sub in part.get("parts", []):
            walk(sub)

    walk(payload)
    return found.get("text/plain") or found.get("text/html") or ""


def _headers(msg: dict) -> dict[str, str]:
    return {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}


def message_to_email(msg: dict) -> dict:
    """Gmail message resource -> the inbox JSON format (ARCHITECTURE.md section 3)."""
    h = _headers(msg)
    name, address = parseaddr(h.get("from", ""))
    try:
        received = parsedate_to_datetime(h["date"]).replace(tzinfo=None).isoformat(timespec="seconds")
    except (KeyError, TypeError, ValueError):
        received = ""
    return {"id": msg["id"], "from_name": name, "from_email": address,
            "subject": h.get("subject", ""), "body": _body(msg.get("payload", {})), "received_at": received}


def fetch_inbox(service, inbox: Path, query: str, limit: int) -> list[str]:
    """Write each matching message as <inbox>/<gmail id>.json. Read-only: no label or read-state changes."""
    listing = service.users().messages().list(userId="me", q=query, maxResults=limit).execute()
    inbox.mkdir(parents=True, exist_ok=True)
    ids: list[str] = []
    for ref in listing.get("messages", []):
        msg = service.users().messages().get(userId="me", id=ref["id"], format="full").execute()
        (inbox / f"{ref['id']}.json").write_text(
            json.dumps(message_to_email(msg), ensure_ascii=False, indent=2), encoding="utf-8")
        ids.append(ref["id"])
    return ids


def _draft_in_thread(service, thread_id: str) -> str:
    """Id of a draft already saved in this thread, or ''. Read-only."""
    drafts = service.users().drafts().list(userId="me", maxResults=100).execute().get("drafts", [])
    return next((d["id"] for d in drafts if d.get("message", {}).get("threadId") == thread_id), "")


def create_draft(service, record: OutboxRecord) -> str:
    """Save record.reply_draft as a threaded Gmail draft replying to the original message. Returns the draft id."""
    msg = service.users().messages().get(userId="me", id=record.email_id, format="metadata",
                                         metadataHeaders=["From", "Reply-To", "Subject", "Message-ID"]).execute()
    h = _headers(msg)
    reply = EmailMessage()
    reply["To"] = h.get("reply-to") or h.get("from", "")
    subject = h.get("subject", "")
    reply["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    if h.get("message-id"):
        reply["In-Reply-To"] = reply["References"] = h["message-id"]
    reply.set_content(record.reply_draft)
    raw = base64.urlsafe_b64encode(reply.as_bytes()).decode()
    existing = _draft_in_thread(service, msg["threadId"])
    if existing:  # the host's disk is wiped on restart, so Gmail itself is the source of truth against duplicates
        return existing
    draft = service.users().drafts().create(
        userId="me", body={"message": {"raw": raw, "threadId": msg["threadId"]}}).execute()
    return draft["id"]
