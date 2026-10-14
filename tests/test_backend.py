import json
from dataclasses import replace
from pathlib import Path

import pytest
from langchain_core.messages import AIMessage

from app.config import ROOT, load_settings
from backend.service import LogTail, NotFound, Service
from tests.test_agent import FakeModel, submit_args


def make_service(tmp_path: Path, calls=None) -> Service:
    s = replace(load_settings(), inbox=tmp_path / "inbox", outbox=tmp_path / "outbox.json", logs=tmp_path / "logs", workers=1)
    s.inbox.mkdir()
    model = FakeModel(calls or [("LookupPolicy", {"reason": "fees", "section": "Fees"}), ("Submit", submit_args())])
    return Service(s, model=model)


def test_create_email_run_and_read_back(tmp_path):
    svc = make_service(tmp_path)
    email_id = svc.create_email("Sara Ali", "sara@example.com", "Late fee", "Please waive my late fee.")
    svc.start_run([email_id])
    svc.wait_idle()
    [row] = svc.list_emails()
    assert row["id"] == email_id and row["status"] == "done" and row["record"]["category"] == "fee"
    detail = svc.detail(email_id)
    assert [s["action"] for s in detail["steps"]][-1] == "validate" and detail["body"].startswith("Please waive")
    assert svc.stats()["total"] == 1 and svc.stats()["by_category"] == {"fee": 1}
    assert svc.state()["running"] is False and svc.state()["done"] == 1


def test_rows_merge_and_pending_status(tmp_path):
    svc = make_service(tmp_path)
    a = svc.create_email("A One", "", "s", "first email body")
    svc.start_run([a])
    svc.wait_idle()
    b = svc.create_email("B Two", "", "s", "second email body")
    assert {e["id"]: e["status"] for e in svc.list_emails()} == {a: "done", b: "pending"}
    svc.start_run([b])
    svc.wait_idle()
    assert len(json.loads((tmp_path / "outbox.json").read_text(encoding="utf-8"))) == 2


def test_no_model_still_writes_fallback_row(tmp_path):
    svc = make_service(tmp_path)
    svc.model = None
    email_id = svc.create_email("Sara", "", "hi", "hello there")
    svc.start_run([email_id])
    svc.wait_idle()
    assert svc.list_emails()[0]["record"]["confidence"] == 0.0 and svc.stats()["needs_human_fallback"] == 1


@pytest.mark.parametrize("bad", ["../secrets/token", "a/b", "", "x" * 200, "nope"])
def test_unknown_or_unsafe_ids_are_not_found(tmp_path, bad):
    svc = make_service(tmp_path)
    with pytest.raises(NotFound):
        svc.detail(bad)
    assert svc.steps(bad) == []


def test_log_tail_returns_only_new_complete_lines(tmp_path):
    logs = tmp_path / "logs"
    logs.mkdir()
    (logs / "E1.jsonl").write_text('{"step": 1}\n', encoding="utf-8")
    tail = LogTail(logs)
    assert tail.poll() == []
    with (logs / "E1.jsonl").open("a", encoding="utf-8") as f:
        f.write('{"step": 2}\n{"step": 3')
    assert tail.poll() == [{"step": 2}]
    with (logs / "E1.jsonl").open("a", encoding="utf-8") as f:
        f.write("}\n")
    assert tail.poll() == [{"step": 3}]
    (logs / "E1.jsonl").write_text('{"step": 9}\n', encoding="utf-8")  # restarted file
    assert tail.poll() == [{"step": 9}]


def test_policy_view_lists_sections(tmp_path):
    names = [s["section"] for s in make_service(tmp_path).policy_view()]
    assert "Fees" in names and "Escalation rules" in names
