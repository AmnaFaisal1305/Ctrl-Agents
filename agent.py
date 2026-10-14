"""CLI entry: processes every data/inbox/*.json and writes outbox.json. Never crashes (R9)."""
import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

from app.config import load_settings
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


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    settings = load_settings()
    ap = argparse.ArgumentParser(description="Student Helpdesk triage agent")
    ap.add_argument("--inbox", type=Path, default=settings.inbox)
    ap.add_argument("--out", type=Path, default=settings.outbox)
    ap.add_argument("--workers", type=int, default=settings.workers)
    args = ap.parse_args()
    settings = replace(settings, inbox=args.inbox, outbox=args.out, workers=args.workers)

    emails = load_inbox(settings.inbox)
    with ThreadPoolExecutor(max_workers=settings.workers) as pool:
        records = list(pool.map(lambda e: process(e, settings.logs), emails))
    write_outbox(records, settings.outbox)
    print(f"Processed {len(records)} emails -> {settings.outbox}. LLM calls: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
