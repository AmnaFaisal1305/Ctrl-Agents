"""Property checks and adversarial cases (ARCHITECTURE.md section 10).

    python evals/run_evals.py              # tuning cases in evals/cases (uses the real LLM)
    python evals/run_evals.py --heldout    # the held-out set: run once at Gate 3, never while tuning
    python evals/run_evals.py --outbox     # property checks only, on outbox.json (no LLM calls)
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import load_settings  # noqa: E402
from app.graph import run_email  # noqa: E402
from app.llm import make_llm  # noqa: E402
from app.loader import load_email  # noqa: E402
from app.models import OutboxRecord  # noqa: E402
from app.policy import Policy  # noqa: E402
from app.validators import validate  # noqa: E402

KEYS = {"email_id", "category", "priority", "escalate", "escalation_reason",
        "policy_refs", "reply_draft", "confidence", "agent_notes"}


def property_checks(row: dict, email, policy: Policy) -> list[str]:
    """Section 10.2, run on every row. Soft issues are not failures here."""
    if set(row) != KEYS:
        return [f"keys differ: {sorted(set(row) ^ KEYS)}"]
    try:
        rec = OutboxRecord(**row)
    except ValueError as exc:
        return [f"schema: {exc}"]
    # fallback rows are safe holding replies; they have no refs and are checked for shape only
    codes = [] if rec.confidence == 0.0 else list(rec.policy_refs)
    skip = {"ESCALATION_REASON"} if rec.confidence == 0.0 else set()  # fallback rows escalate without an ESC code
    return [f"{i.code}: {i.message}" for i in validate(rec, email, policy, codes) if i.severity == "hard" and i.code not in skip]


def expected_checks(row: dict, expected: dict) -> list[str]:
    fails = []
    if "escalate" in expected and row["escalate"] != expected["escalate"]:
        fails.append(f"escalate is {row['escalate']}, expected {expected['escalate']}")
    refs = expected.get("refs_any_of")
    if refs and not set(refs) & (set(row["policy_refs"]) | {c for c in refs if c in row["escalation_reason"]}):
        fails.append(f"refs {row['policy_refs']} contain none of {refs}")
    reply = row["reply_draft"].lower()
    fails += [f"reply contains forbidden text '{t}'" for t in expected.get("must_not_contain", []) if t.lower() in reply]
    return fails


def run_cases(folder: Path) -> int:
    settings = load_settings()
    policy, model = Policy.parse(settings.policy), make_llm(settings)
    failed = calls = 0
    for path in sorted(folder.glob("*.json")):
        email = load_email(path)
        expected = json.loads(path.read_text(encoding="utf-8")).get("expected", {})
        record, n = run_email(email, model, policy, settings.logs / "evals")
        calls += n
        problems = property_checks(record.model_dump(), email, policy) + expected_checks(record.model_dump(), expected)
        failed += bool(problems)
        print(f"{'FAIL' if problems else 'ok  '} {email.id}: {record.category}/{record.priority} esc={record.escalate} refs={record.policy_refs}")
        for p in problems:
            print(f"       - {p}")
    print(f"\n{failed} of {len(list(folder.glob('*.json')))} cases failed. LLM calls: {calls}")
    return failed


def run_outbox() -> int:
    settings = load_settings()
    policy = Policy.parse(settings.policy)
    rows = json.loads(settings.outbox.read_text(encoding="utf-8"))
    files = sorted(settings.inbox.glob("*.json"))
    problems = 0
    if len(rows) != len(files):
        print(f"FAIL row count {len(rows)} != file count {len(files)}")
        problems += 1
    for row in rows:
        email = load_email(settings.inbox / f"{row['email_id']}.json")
        bad = property_checks(row, email, policy)
        problems += bool(bad)
        print(f"{'FAIL' if bad else 'ok  '} {row['email_id']}", *bad, sep="\n       - " if bad else "")
    print(f"\n{problems} problem(s) over {len(rows)} rows")
    return problems


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--heldout", action="store_true")
    ap.add_argument("--outbox", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    code = run_outbox() if a.outbox else run_cases(ROOT / "evals" / ("heldout" if a.heldout else "cases"))
    raise SystemExit(1 if code else 0)
