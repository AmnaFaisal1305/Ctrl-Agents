"""CLI entry: processes every data/inbox/*.json and writes outbox.json. Never crashes (R9)."""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

from app.config import Settings, load_settings
from app.fallback import fallback_record
from app.loader import load_inbox
from app.logger import log_step
from app.models import EmailIn, OutboxRecord
from app.writer import write_outbox


def process(email: EmailIn, logs: Path) -> OutboxRecord:
    """Stub agent (P0.1): no LLM yet, so every email gets the safe fallback row."""
    try:
        reason = "; ".join(email.load_warnings) if not (email.body or email.subject) else "agent not implemented yet"
        record = fallback_record(email, reason)
        log_step(logs, email.id, 1, "rule", "fallback", reason)
        return record
    except Exception as exc:  # fail soft: every email gets a row
        return fallback_record(email, f"unexpected error: {type(exc).__name__}")


def save_drafts(service, records: list[OutboxRecord], gmail_ids: set[str], logs: Path) -> None:
    """Mirror reply_draft into Gmail DRAFTS (never sent) for mail fetched this run; skip ones already drafted."""
    from app.gmail import create_draft

    state_file = logs / "gmail_drafts.json"
    done: dict[str, str] = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    for rec in records:
        if rec.email_id not in gmail_ids or rec.email_id in done:
            continue
        try:
            done[rec.email_id] = create_draft(service, rec)
            log_step(logs, rec.email_id, 99, "rule", "gmail_draft", f"draft saved ({done[rec.email_id]})")
        except Exception as exc:  # one failed draft must not stop the run
            log_step(logs, rec.email_id, 99, "rule", "gmail_draft", f"draft failed: {type(exc).__name__}")
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
    ap.add_argument("--gmail", action="store_true", help="fetch the Gmail query into the inbox, then save replies as drafts (never sent)")
    ap.add_argument("--no-drafts", action="store_true", help="with --gmail: fetch and process but do not create drafts")
    args = ap.parse_args()
    settings = replace(settings, inbox=args.inbox, outbox=args.out, workers=args.workers)

    service, gmail_ids = gmail_fetch(settings) if args.gmail else (None, set())
    emails = load_inbox(settings.inbox)
    with ThreadPoolExecutor(max_workers=settings.workers) as pool:
        records = list(pool.map(lambda e: process(e, settings.logs), emails))
    write_outbox(records, settings.outbox)
    if service and not args.no_drafts:
        save_drafts(service, records, gmail_ids, settings.logs)
    print(f"Processed {len(records)} emails -> {settings.outbox}. LLM calls: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
