"""CLI entry: processes every data/inbox/*.json and writes outbox.json. Never crashes (R9)."""
import argparse
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

from app.config import Settings, load_settings
from app.fallback import fallback_record
from app.graph import run_email
from app.llm import make_llm
from app.loader import load_inbox
from app.logger import log_step
from app.models import EmailIn, OutboxRecord
from app.reflect import make_critic, reflect_enabled
from app.policy import Policy
from app.writer import write_outbox


def process(email: EmailIn, model, policy: Policy, logs: Path, critic=None) -> tuple[OutboxRecord, int]:
    """Run the LangGraph agent for one email. Returns (record, llm_calls); never raises."""
    try:
        if model is None:
            log_step(logs, email.id, 0, "rule", "fallback", "LLM unavailable")
            return fallback_record(email, "LLM unavailable"), 0
        return run_email(email, model, policy, logs, critic)
    except Exception as exc:  # fail soft: every email gets a row
        return fallback_record(email, f"unexpected error: {type(exc).__name__}"), 0


def email_hash(email: EmailIn) -> str:
    return hashlib.sha256(f"{email.from_name}|{email.from_email}|{email.subject}|{email.body}".encode()).hexdigest()


def reusable_rows(emails: list[EmailIn], outbox: Path, logs: Path) -> dict[str, OutboxRecord]:
    """--only-new: rows from the last run for emails whose content is unchanged."""
    seen_file = logs / "seen.json"
    try:
        seen = json.loads(seen_file.read_text(encoding="utf-8"))
        rows = {r["email_id"]: OutboxRecord(**r) for r in json.loads(outbox.read_text(encoding="utf-8"))}
    except (OSError, ValueError, TypeError, KeyError):
        return {}
    return {e.id: rows[e.id] for e in emails if e.id in rows and seen.get(e.id) == email_hash(e)}


def save_drafts(service, records: list[OutboxRecord], gmail_ids: set[str], logs: Path, done: dict[str, str] | None = None) -> None:
    """Mirror reply_draft into Gmail DRAFTS (never sent) for mail fetched this run; skip ones already drafted.

    `done` (email id -> draft id) is kept by the caller when given (the backend stores it in SQLite);
    otherwise it lives in logs/gmail_drafts.json."""
    from app.gmail import create_draft

    state_file = logs / "gmail_drafts.json"
    own_state = done is None
    if own_state:
        done = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    for rec in records:
        if rec.email_id not in gmail_ids or rec.email_id in done:
            continue
        try:
            done[rec.email_id] = create_draft(service, rec)
            log_step(logs, rec.email_id, 99, "rule", "gmail_draft", f"draft saved ({done[rec.email_id]})")
        except Exception as exc:  # one failed draft must not stop the run
            log_step(logs, rec.email_id, 99, "rule", "gmail_draft", f"draft failed: {type(exc).__name__}")
    if own_state:
        logs.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps(done, indent=2), encoding="utf-8")


def gmail_fetch(settings: Settings):
    from app.gmail import fetch_inbox, get_service

    service = get_service(settings.secrets)
    ids = fetch_inbox(service, settings.inbox, settings.gmail_query, settings.gmail_max)
    print(f"Gmail: fetched {len(ids)} messages for query {settings.gmail_query!r}", flush=True)
    return service, set(ids)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    settings = load_settings()
    ap = argparse.ArgumentParser(description="Student Helpdesk triage agent")
    ap.add_argument("--inbox", type=Path, default=settings.inbox)
    ap.add_argument("--out", type=Path, default=settings.outbox)
    ap.add_argument("--workers", type=int, default=settings.workers)
    ap.add_argument("--only-new", action="store_true", help="reuse rows from the last run for unchanged emails")
    ap.add_argument("--gmail", action="store_true", help="fetch the Gmail query into the inbox, then save replies as drafts (never sent)")
    ap.add_argument("--no-drafts", action="store_true", help="with --gmail: fetch and process but do not create drafts")
    args = ap.parse_args()
    settings = replace(settings, inbox=args.inbox, outbox=args.out, workers=args.workers)

    service, gmail_ids = gmail_fetch(settings) if args.gmail else (None, set())
    emails = load_inbox(settings.inbox)
    policy = Policy.parse(settings.policy)
    reused = reusable_rows(emails, settings.outbox, settings.logs) if args.only_new else {}
    todo = [e for e in emails if e.id not in reused]
    try:
        model = make_llm(settings)
    except Exception as exc:  # e.g. missing GOOGLE_API_KEY: every email still gets a fallback row
        print(f"LLM unavailable ({type(exc).__name__}); writing fallback rows", flush=True)
        model = None
    critic = None
    if model is not None and reflect_enabled():
        try:
            critic = make_critic(settings)
        except Exception as exc:  # the review is optional
            print(f"Reflection disabled ({type(exc).__name__})", flush=True)
    with ThreadPoolExecutor(max_workers=settings.workers) as pool:
        results = list(pool.map(lambda e: process(e, model, policy, settings.logs, critic), todo))
    records = [r for r, _ in results] + list(reused.values())
    settings.logs.mkdir(parents=True, exist_ok=True)
    (settings.logs / "seen.json").write_text(json.dumps({e.id: email_hash(e) for e in emails}), encoding="utf-8")
    write_outbox(records, settings.outbox)
    if service and not args.no_drafts:
        save_drafts(service, records, gmail_ids, settings.logs)
    print(f"Processed {len(records)} emails ({len(reused)} reused) -> {settings.outbox}. LLM calls: {sum(n for _, n in results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
