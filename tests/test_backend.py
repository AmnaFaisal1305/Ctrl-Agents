import json
from dataclasses import replace
from pathlib import Path

import pytest
from langchain_core.messages import AIMessage

from app.config import ROOT, load_settings
from backend.service import LogTail, NotFound, Service
from tests.test_agent import FakeModel, submit_args


def make_service(tmp_path: Path, calls=None) -> Service:
    s = replace(load_settings(), inbox=tmp_path / "inbox", outbox=tmp_path / "outbox.json", logs=tmp_path / "logs", workers=1,
                db_path=tmp_path / "t.db")
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
    assert len(svc.outbox_rows()) == 2


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


def fake_request(svc):
    from types import SimpleNamespace

    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(svc=svc)), headers={})


def test_start_run_rejects_unknown_ids(tmp_path):
    svc = make_service(tmp_path)
    with pytest.raises(NotFound):
        svc.start_run(["ghost"])


def test_reprocess_replaces_row_and_log(tmp_path):
    svc = make_service(tmp_path)
    email_id = svc.create_email("Sara", "", "Late fee", "Please waive my late fee.")
    svc.start_run([email_id])
    svc.wait_idle()
    svc.model = FakeModel([("LookupPolicy", {"reason": "fees", "section": "Fees"}), ("Submit", submit_args())])
    svc.reprocess(email_id)
    svc.wait_idle()
    assert len(svc.outbox_rows()) == 1
    assert [s["step"] for s in svc.steps(email_id)] == [0, 1, 1, 2, 2]  # context row + one run's log, not two appended


def test_delete_only_web_emails(tmp_path):
    svc = make_service(tmp_path)
    web = svc.create_email("Sara", "", "hi", "hello there")
    svc.start_run([web])
    svc.wait_idle()
    svc.store.put_email("E001", json.dumps({"id": "E001", "subject": "s", "body": "b"}))
    with pytest.raises(Exception) as err:
        svc.delete_email("E001")
    assert type(err.value).__name__ == "Protected" and svc.store.email_raw("E001")
    svc.delete_email(web)
    assert svc.outbox_rows() == [] and svc.store.email_raw(web) is None and svc.steps(web) == []


def test_job_error_is_reported_not_swallowed(tmp_path):
    svc = make_service(tmp_path)
    email_id = svc.create_email("Sara", "", "hi", "hello there")
    svc._process = lambda todo: (_ for _ in ()).throw(RuntimeError("boom"))
    svc.start_run([email_id])
    svc.wait_idle()
    assert svc.state()["error"].startswith("RuntimeError") and svc.state()["running"] is False


def test_gmail_requires_token_then_fetches_and_drafts_only_on_request(tmp_path, monkeypatch):
    import agent
    from backend.service import GmailNotReady

    svc = make_service(tmp_path)
    svc.s = replace(svc.s, secrets=tmp_path / "secrets")
    with pytest.raises(GmailNotReady):
        svc.start_gmail()
    (tmp_path / "secrets").mkdir()
    (tmp_path / "secrets" / "token.json").write_text("{}", encoding="utf-8")

    def fake_fetch(settings):
        (settings.inbox / "g1.json").write_text(json.dumps({"id": "g1", "from_name": "Gia", "subject": "Fee", "body": "Late fee?"}), encoding="utf-8")
        return object(), {"g1"}

    drafts = []
    monkeypatch.setattr(agent, "gmail_fetch", fake_fetch)
    monkeypatch.setattr(agent, "save_drafts", lambda service, records, ids, logs, done=None: drafts.append([r.email_id for r in records]))
    svc.start_gmail(create_drafts=False)
    svc.wait_idle()
    assert [r["email_id"] for r in svc.outbox_rows()] == ["g1"] and drafts == []
    svc.start_gmail(create_drafts=True)
    svc.wait_idle()
    assert drafts == [["g1"]]


def test_routes_validate_input_and_map_errors(tmp_path, monkeypatch):
    from fastapi import HTTPException

    for name in ("ADMIN_KEY", "DEMO_PASSWORD"):  # set empty so a local .env cannot turn the gates on (load_dotenv never overrides)
        monkeypatch.setenv(name, "")

    from backend import main

    svc = make_service(tmp_path)
    svc.s = replace(svc.s, secrets=tmp_path / "no-secrets")  # never touch the real Gmail token in tests
    req = fake_request(svc)
    with pytest.raises(HTTPException) as e:
        main.create_email(main.NewEmail(subject=" ", body=""), req)
    assert e.value.status_code == 422
    with pytest.raises(HTTPException) as e:
        main.email_detail("nope", req)
    assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        main.process(main.RunRequest(ids=["ghost"]), req)
    assert e.value.status_code == 422
    with pytest.raises(HTTPException) as e:
        main.gmail_fetch(main.GmailRequest(), req)
    assert e.value.status_code == 409
    made = main.create_email(main.NewEmail(subject="Hi", body="hello", process=False), req)
    assert made["id"].startswith("web-") and made["run"] is None
    with pytest.raises(HTTPException) as e:
        main.delete_email("E001", req)
    assert e.value.status_code == 404


def _req(path="/api/emails", headers=None, query=""):
    from starlette.requests import Request

    scope = {"type": "http", "path": path, "query_string": query.encode(),
             "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]}
    return Request(scope)


def test_login_token_gates_the_api_when_a_password_is_set(monkeypatch):
    from fastapi import HTTPException

    from backend import auth, main

    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    main.require_auth(_req())  # unset: open (local dev)
    assert main.login(main.LoginRequest(password="x")) == {"token": "", "auth_required": False}
    monkeypatch.setenv("DEMO_PASSWORD", "pw")
    monkeypatch.setenv("AUTH_SECRET", "sign-key")
    with pytest.raises(HTTPException) as e:
        main.require_auth(_req())
    assert e.value.status_code == 401
    with pytest.raises(HTTPException):
        main.login(main.LoginRequest(password="wrong"))
    token = main.login(main.LoginRequest(password="pw"))["token"]
    main.require_auth(_req(headers={"X-Auth": token}))
    main.require_auth(_req("/api/events", query=f"auth={token}"))
    main.require_auth(_req("/api/health"))  # health and login stay open
    main.require_auth(_req("/api/login"))
    with pytest.raises(HTTPException):
        main.require_auth(_req(headers={"X-Auth": token[:-1] + ("0" if token[-1] != "0" else "1")}))  # tampered signature
    assert not auth.token_ok(auth.make_token(now=0))  # expired long ago


def test_gmail_needs_the_admin_key_when_deployed(tmp_path, monkeypatch):
    from fastapi import HTTPException

    from backend import main

    svc = make_service(tmp_path)
    svc.s = replace(svc.s, secrets=tmp_path / "no-secrets")
    monkeypatch.setenv("DEMO_PASSWORD", "pw")
    monkeypatch.delenv("ADMIN_KEY", raising=False)
    req = fake_request(svc)
    with pytest.raises(HTTPException) as e:
        main.gmail_fetch(main.GmailRequest(), req)  # deployed but no ADMIN_KEY configured: refused
    assert e.value.status_code == 403
    monkeypatch.setenv("ADMIN_KEY", "adm")
    with pytest.raises(HTTPException) as e:
        main.gmail_fetch(main.GmailRequest(), req)  # wrong key
    assert e.value.status_code == 403
    req.headers = {"x-admin-key": "adm"}
    with pytest.raises(HTTPException) as e:
        main.gmail_fetch(main.GmailRequest(), req)  # key accepted: now it fails only because Gmail is not authorized
    assert e.value.status_code == 409


def test_daily_llm_cap_returns_429(tmp_path):
    from fastapi import HTTPException

    from backend import main

    svc = make_service(tmp_path)
    svc.daily_cap = 3
    email_id = svc.create_email("Sara", "", "Late fee", "Please waive my late fee.")
    svc.start_run([email_id])
    svc.wait_idle()
    assert svc.store.llm_calls_today() == 2
    svc.store.add_llm_calls(1)
    with pytest.raises(HTTPException) as e:
        main.reprocess(email_id, fake_request(svc))
    assert e.value.status_code == 429


def test_metrics_from_a_real_run_and_synthetic_rows(tmp_path):
    from backend.metrics import aggregate

    svc = make_service(tmp_path, [("Submit", submit_args(reply_draft="no sign off")),
                                  ("LookupPolicy", {"reason": "fees", "section": "Fees"}), ("Submit", submit_args())])
    email_id = svc.create_email("Sara", "", "Late fee", "Please waive my late fee.")
    svc.start_run([email_id])
    svc.wait_idle()
    m = svc.metrics()
    assert m["emails"] == 1 and m["llm_calls"] == 3
    assert m["recovery"]["self_healed"] == 1 and m["recovery"]["rejections_by_code"]["SIGN_OFF"] == 1
    assert m["tool_usage"] == {"Submit": 2, "LookupPolicy": 1} and m["per_email"][0]["outcome"] == "accepted"
    rows = {"a": [{"action": "reflect", "decided_by": "model", "latency_ms": 900, "meta": {"verdict": "concerns", "issues": [{"aspect": "tone"}], "input_tokens": 5, "output_tokens": 6}},
                  {"action": "fallback", "decided_by": "rule", "reason": "x"}]}
    agg = aggregate(rows)
    assert agg["critic"] == {"verdicts": {"concerns": 1}, "aspects": {"tone": 1}} and agg["outcomes"] == {"fallback": 1}
    assert agg["input_tokens"] == 5 and aggregate({})["emails"] == 0


def test_harness_and_evals_views(tmp_path):
    svc = make_service(tmp_path)
    h = svc.harness()
    assert h["max_model_turns"] == 6 and h["reflection"] is False and len(h["guards"]) >= 5
    email_id = svc.create_email("Sara", "", "Late fee", "Please waive my late fee.")
    svc.start_run([email_id])
    svc.wait_idle()
    ev = svc.evals()
    assert ev["live"]["checked"] == 1 and ev["live"]["failed"] == 0 and set(ev["saved"]) == {"cases", "heldout"}
