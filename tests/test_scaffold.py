import json
from pathlib import Path

import pytest

from app.config import ROOT
from app.fallback import fallback_record
from app.loader import load_email, load_inbox
from app.models import EmailIn, OutboxRecord
from app.policy import Policy
from app.writer import write_outbox

KEYS = {"email_id", "category", "priority", "escalate", "escalation_reason",
        "policy_refs", "reply_draft", "confidence", "agent_notes"}


def test_fallback_has_exactly_nine_keys_and_rules():
    rec = fallback_record(EmailIn(id="X1", from_name="Ayesha Khan"), "test")
    assert set(rec.model_dump()) == KEYS
    assert rec.reply_draft.endswith("Student Helpdesk")
    assert len(rec.reply_draft.split()) < 150
    assert rec.reply_draft.startswith("Dear Ayesha")


@pytest.mark.parametrize("content", ["{not json", "", "[1, 2]"])
def test_bad_files_still_yield_an_email(tmp_path: Path, content: str):
    f = tmp_path / "bad.json"
    f.write_text(content, encoding="utf-8")
    email = load_email(f)
    assert email.id == "bad" and email.load_warnings


def test_loader_strips_html_and_fills_missing_id(tmp_path: Path):
    f = tmp_path / "E9.json"
    f.write_text(json.dumps({"subject": "Hi", "body": "<p>Hello&nbsp;<b>there</b></p>"}), encoding="utf-8")
    email = load_email(f)
    assert email.id == "E9" and email.body == "Hello there"
    assert any("missing id" in w for w in email.load_warnings)


def test_loader_truncates_long_body(tmp_path: Path):
    f = tmp_path / "long.json"
    f.write_text(json.dumps({"id": "L", "body": "a" * 5000}), encoding="utf-8")
    email = load_email(f)
    assert len(email.body) == 4000 and any("shortened" in w for w in email.load_warnings)


def test_policy_parses_all_clauses():
    policy = Policy.parse(ROOT / "data" / "policy.md")
    assert {"FEE-2", "HOSTEL-3", "ACAD-2", "TECH-1", "ESC-6"} <= set(policy.by_code)
    assert [c.code for c in policy.lookup(codes=["FEE-2", "NOPE"])] == ["FEE-2"]
    assert len(policy.lookup(section="fees")) == 4
    assert policy.lookup(query="late fee waiver")[0].code == "FEE-2"
    assert policy.lookup(query="zzzz") == []


def test_writer_sorts_and_writes_valid_json(tmp_path: Path):
    recs = [fallback_record(EmailIn(id=i), "t") for i in ("E2", "E1")]
    out = tmp_path / "outbox.json"
    write_outbox(recs, out)
    rows = json.loads(out.read_text(encoding="utf-8"))
    assert [r["email_id"] for r in rows] == ["E1", "E2"]
    assert all(set(r) == KEYS for r in rows)
    OutboxRecord.model_validate(rows[0])


def test_sample_inbox_loads_twenty():
    assert len(load_inbox(ROOT / "data" / "inbox")) == 20


def test_query_lookup_prefers_rare_words():
    policy = Policy.parse(ROOT / "data" / "policy.md")
    codes = [c.code for c in policy.lookup(query="fee installments and application deadlines")]
    assert "FEE-3" in codes
