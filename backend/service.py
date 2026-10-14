"""Backend logic over the agent. No HTTP in this file; routes live in main.py.

Reuses the CLI code (agent.process, app.*), so the API and `python agent.py` behave the same.
"""
import json
import re
import secrets
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import agent
from app.config import BODY_LIMIT, MAX_STEPS, WORD_LIMIT, Settings
from app.graph import MAX_REVISIONS
from app.llm import make_llm
from app.loader import load_email, load_inbox
from app.models import EmailIn, OutboxRecord
from app.policy import Policy
from app.reflect import make_critic, reflect_enabled
from app.writer import write_outbox
from backend.metrics import aggregate

_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,100}$")


class NotFound(Exception):
    pass


class Protected(Exception):
    """The action is not allowed on this email."""


class GmailNotReady(Exception):
    pass


class Service:
    def __init__(self, settings: Settings, model=None) -> None:
        self.s = settings
        self.policy = Policy.parse(settings.policy)
        self.model = model if model is not None else self._make_model()
        self.critic = self._make_critic() if model is None and self.model is not None else None  # tests inject a model and get no critic
        self._pool = ThreadPoolExecutor(max_workers=1)  # one run at a time; the next waits its turn
        self._lock = threading.Lock()  # guards _state
        self._io = threading.Lock()  # guards the outbox.json read-modify-write
        self._state = {"running": False, "total": 0, "done": 0, "llm_calls": 0, "queued": 0, "pending_ids": [], "error": ""}

    def _make_model(self):
        try:
            return make_llm(self.s)
        except Exception:  # e.g. missing key: runs still write fallback rows, like the CLI
            return None

    def _make_critic(self):
        if not reflect_enabled():
            return None
        try:
            return make_critic(self.s)
        except Exception:
            return None

    # ---- reads -------------------------------------------------------------------------------
    def _records(self) -> dict[str, dict]:
        try:
            return {r["email_id"]: r for r in json.loads(self.s.outbox.read_text(encoding="utf-8"))}
        except (OSError, ValueError, KeyError, TypeError):
            return {}

    def _path(self, email_id: str) -> Path:
        if not _SAFE_ID.match(email_id):
            raise NotFound(email_id)
        path = self.s.inbox / f"{email_id}.json"
        if not path.exists():
            raise NotFound(email_id)
        return path

    def state(self) -> dict:
        with self._lock:
            return dict(self._state, pending_ids=list(self._state["pending_ids"]))

    def health(self) -> dict:
        return {"status": "ok", "model": self.s.model, "llm_ready": self.model is not None}

    def _summary(self, email: EmailIn, records: dict[str, dict], pending: set[str]) -> dict:
        record = records.get(email.id)
        status = "processing" if email.id in pending else ("done" if record else "pending")
        return {"id": email.id, "from_name": email.from_name, "from_email": email.from_email, "subject": email.subject,
                "received_at": email.received_at, "status": status, "record": record}

    def list_emails(self) -> list[dict]:
        records, pending = self._records(), set(self.state()["pending_ids"])
        return [self._summary(e, records, pending) for e in load_inbox(self.s.inbox)]

    def detail(self, email_id: str) -> dict:
        email = load_email(self._path(email_id))
        out = self._summary(email, self._records(), set(self.state()["pending_ids"]))
        return {**out, "body": email.body, "load_warnings": email.load_warnings, "steps": self.steps(email_id)}

    def steps(self, email_id: str) -> list[dict]:
        path = self.s.logs / f"{email_id}.jsonl"
        if not _SAFE_ID.match(email_id) or not path.exists():
            return []
        rows = []
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                rows.append(json.loads(line))
            except ValueError:
                continue
        return rows

    def stats(self) -> dict:
        rows = list(self._records().values())
        count = lambda key: {k: sum(1 for r in rows if r[key] == k) for k in sorted({r[key] for r in rows})}  # noqa: E731
        return {"total": len(rows), "emails_in_inbox": len(list(self.s.inbox.glob("*.json"))),
                "escalated": sum(1 for r in rows if r["escalate"]),
                "needs_human_fallback": sum(1 for r in rows if r["confidence"] == 0.0),
                "avg_confidence": round(sum(r["confidence"] for r in rows) / len(rows), 2) if rows else 0.0,
                "by_category": count("category"), "by_priority": count("priority")}

    def metrics(self) -> dict:
        """Observability numbers aggregated from logs/*.jsonl (the latest run of each email)."""
        return aggregate({p.stem: self.steps(p.stem) for p in sorted(self.s.logs.glob("*.jsonl"))})

    def harness(self) -> dict:
        """The guard rails around the model, from the real constants (shown on the Observability page)."""
        return {"model": self.s.model, "temperature": 0, "timeout_s": 30, "sdk_retries": 3, "workers": self.s.workers,
                "max_model_turns": MAX_STEPS, "max_revisions": MAX_REVISIONS, "word_limit": WORD_LIMIT, "body_limit_chars": BODY_LIMIT,
                "reflection": self.critic is not None,
                "guards": [
                    {"name": "Schema", "detail": "Submit arguments must parse into the 9-field record."},
                    {"name": "Validators", "detail": "Hard checks on every submit (word limit, sign-off, real and looked-up policy codes, no invented contacts, escalation reason, policy code on escalations). Failures go back to the model."},
                    {"name": "Safety net", "detail": "Life-safety wording forces escalation (ESC-1, ESC-3) after the model decides."},
                    {"name": "Budgets", "detail": f"At most {MAX_STEPS} model turns and {MAX_REVISIONS} revisions per email."},
                    {"name": "Fallback row", "detail": "Any failure writes a safe escalating row; every email always gets a row."},
                    {"name": "Reflection", "detail": "A second model reviews the final record in shadow mode; it is logged and never changes the row."}]}

    def evals(self) -> dict:
        """Saved eval runs (tuning, held-out) plus a free live property check over the current outbox."""
        from evals.run_evals import property_checks

        saved = {}
        for mode in ("cases", "heldout"):
            try:
                saved[mode] = json.loads((self.s.logs / "evals" / f"results-{mode}.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                saved[mode] = None
        policy, live = self.policy, []
        for row in self.outbox_rows():
            try:
                problems = property_checks(row, load_email(self._path(row["email_id"])), policy)
            except NotFound:
                continue
            live.append({"id": row["email_id"], "passed": not problems, "problems": problems})
        return {"saved": saved, "live": {"checked": len(live), "failed": sum(not r["passed"] for r in live), "rows": live}}

    def policy_view(self) -> list[dict]:
        return [{"section": name, "clauses": [{"code": c.code, "text": c.text} for c in self.policy.section(name)]}
                for name in self.policy.sections()]

    # ---- writes ------------------------------------------------------------------------------
    def create_email(self, from_name: str, from_email: str, subject: str, body: str) -> str:
        """Save a new email into the inbox folder (the agent reads that folder). Never sends anything."""
        email_id = f"web-{datetime.now():%Y%m%d-%H%M%S}-{secrets.token_hex(2)}"
        data = {"id": email_id, "from_name": from_name.strip(), "from_email": from_email.strip(),
                "subject": subject.strip(), "body": body.strip(), "received_at": datetime.now().isoformat(timespec="seconds")}
        self.s.inbox.mkdir(parents=True, exist_ok=True)
        (self.s.inbox / f"{email_id}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return email_id

    def start_run(self, ids: list[str] | None = None, only_new: bool = False) -> dict:
        """Queue a run over `ids` (None = every file in the inbox). Returns the run state immediately."""
        for email_id in ids or []:
            self._path(email_id)  # raises NotFound for unknown or unsafe ids
        return self._queue(self._run, ids, only_new)

    def reprocess(self, email_id: str) -> dict:
        return self.start_run([email_id])

    def gmail_ready(self) -> bool:
        """The OAuth token exists; the browser authorization is done once with `python agent.py --gmail`."""
        return (self.s.secrets / "token.json").exists()

    def start_gmail(self, create_drafts: bool = False) -> dict:
        if not self.gmail_ready():
            raise GmailNotReady("Gmail is not authorized yet: run `python agent.py --gmail` once in a terminal.")
        return self._queue(self._gmail_job, create_drafts)

    def delete_email(self, email_id: str) -> None:
        """Remove an email added through the API (web-*) with its row and log. Sample and Gmail emails are protected."""
        path = self._path(email_id)
        if not email_id.startswith("web-"):
            raise Protected(email_id)
        if email_id in self.state()["pending_ids"]:
            raise Protected(f"{email_id} is being processed")
        with self._io:
            rows = {k: v for k, v in self._records().items() if k != email_id}
            write_outbox([OutboxRecord(**v) for v in rows.values()], self.s.outbox)
            path.unlink(missing_ok=True)
        (self.s.logs / f"{email_id}.jsonl").unlink(missing_ok=True)

    def outbox_rows(self) -> list[dict]:
        return sorted(self._records().values(), key=lambda r: r["email_id"])

    def _queue(self, fn, *args) -> dict:
        with self._lock:
            self._state["queued"] += 1
        self._pool.submit(self._job, fn, *args)
        return self.state()

    def _job(self, fn, *args) -> None:
        with self._lock:
            self._state["queued"] -= 1
            self._state["error"] = ""
        try:
            fn(*args)
        except Exception as exc:  # the run thread must never die silently; the UI shows `error`
            with self._lock:
                self._state["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
        finally:
            with self._lock:
                self._state.update(running=False, pending_ids=[])

    def _run(self, ids: list[str] | None, only_new: bool) -> None:
        emails = [e for e in load_inbox(self.s.inbox) if ids is None or e.id in ids]
        reused = agent.reusable_rows(emails, self.s.outbox, self.s.logs) if only_new else {}
        self._process([e for e in emails if e.id not in reused])

    def _process(self, todo: list[EmailIn]) -> None:
        with self._lock:
            self._state.update(running=True, total=len(todo), done=0, llm_calls=0, pending_ids=[e.id for e in todo])
        by_id = {e.id: e for e in todo}
        with ThreadPoolExecutor(max_workers=self.s.workers) as pool:
            futures = [pool.submit(agent.process, e, self.model, self.policy, self.s.logs, self.critic) for e in todo]
            for future in as_completed(futures):
                record, calls = future.result()
                self._save(record, by_id[record.email_id])
                with self._lock:
                    self._state["done"] += 1
                    self._state["llm_calls"] += calls
                    self._state["pending_ids"].remove(record.email_id)

    def _gmail_job(self, create_drafts: bool) -> None:
        """Fetch the Gmail label into the inbox, process what was fetched, optionally save DRAFTS (never sent)."""
        service, ids = agent.gmail_fetch(self.s)
        self._process([e for e in load_inbox(self.s.inbox) if e.id in ids])
        if create_drafts:
            records = [OutboxRecord(**r) for r in self._records().values() if r["email_id"] in ids]
            agent.save_drafts(service, records, ids, self.s.logs)

    def _save(self, record: OutboxRecord, email: EmailIn) -> None:
        """Merge one finished row into outbox.json (so the UI sees it at once) and remember the email hash."""
        with self._io:
            rows = {k: OutboxRecord(**v) for k, v in self._records().items()}
            rows[record.email_id] = record
            write_outbox(list(rows.values()), self.s.outbox)
            seen_file = self.s.logs / "seen.json"
            try:
                seen = json.loads(seen_file.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                seen = {}
            seen[email.id] = agent.email_hash(email)
            self.s.logs.mkdir(parents=True, exist_ok=True)
            seen_file.write_text(json.dumps(seen), encoding="utf-8")

    def wait_idle(self, timeout: float = 60.0) -> None:
        """For tests and scripts: block until queued runs finish."""
        self._pool.submit(lambda: None).result(timeout)


class LogTail:
    """Yields new step rows from logs/*.jsonl since the last poll. Powers the SSE stream."""

    def __init__(self, logs: Path) -> None:
        self.logs = logs
        self.offsets = {p: p.stat().st_size for p in logs.glob("*.jsonl")}

    def poll(self) -> list[dict]:
        out = []
        for path in sorted(self.logs.glob("*.jsonl")):
            try:
                size, offset = path.stat().st_size, self.offsets.get(path, 0)
                if size < offset:  # the file was restarted by a new run
                    offset = 0
                if size == offset:
                    continue
                with path.open("rb") as f:
                    f.seek(offset)
                    chunk = f.read()
            except OSError:
                continue
            complete = chunk[: chunk.rfind(b"\n") + 1]
            self.offsets[path] = offset + len(complete)
            for line in complete.decode("utf-8", errors="replace").splitlines():
                try:
                    out.append(json.loads(line))
                except ValueError:
                    continue
        return out
