import base64
import json
import re
from email import message_from_bytes
from pathlib import Path

from app.config import ROOT
from app.fallback import fallback_record
from app.gmail import SCOPES, create_draft, fetch_inbox, message_to_email
from app.models import EmailIn


def enc(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


MSG = {"id": "m1", "threadId": "t1", "payload": {
    "headers": [{"name": "From", "value": "Hamza Q <hamza@example.com>"}, {"name": "Subject", "value": "Late fee"},
                {"name": "Date", "value": "Mon, 12 Oct 2026 09:15:00 +0000"}, {"name": "Message-ID", "value": "<abc@x>"}],
    "mimeType": "multipart/alternative",
    "parts": [{"mimeType": "text/html", "body": {"data": enc("<p>html</p>")}},
              {"mimeType": "text/plain", "body": {"data": enc("plain text")}}]}}


class Call:
    def __init__(self, result, log=None, name=""):
        self.result, self.log, self.name = result, log, name

    def execute(self):
        return self.result


class FakeService:
    def __init__(self):
        self.created: list[dict] = []

    def users(self):
        return self

    def messages(self):
        outer = self

        class M:
            def list(self, **kw):
                return Call({"messages": [{"id": "m1"}]})

            def get(self, **kw):
                return Call(MSG)

        return M()

    def drafts(self):
        outer = self

        class D:
            def create(self, userId, body):
                outer.created.append(body)
                return Call({"id": "d1"})

        return D()


def test_message_to_email_prefers_plain_and_parses_headers():
    e = message_to_email(MSG)
    assert e == {"id": "m1", "from_name": "Hamza Q", "from_email": "hamza@example.com", "subject": "Late fee",
                 "body": "plain text", "received_at": "2026-10-12T09:15:00"}


def test_fetch_inbox_writes_files(tmp_path: Path):
    assert fetch_inbox(FakeService(), tmp_path, "label:helpdesk", 5) == ["m1"]
    assert json.loads((tmp_path / "m1.json").read_text(encoding="utf-8"))["body"] == "plain text"


def test_create_draft_is_threaded_reply():
    svc = FakeService()
    rec = fallback_record(EmailIn(id="m1", from_name="Hamza Q"), "t")
    assert create_draft(svc, rec) == "d1"
    body = svc.created[0]["message"]
    assert body["threadId"] == "t1"
    mime = message_from_bytes(base64.urlsafe_b64decode(body["raw"]))
    assert mime["Subject"] == "Re: Late fee" and mime["In-Reply-To"] == "<abc@x>"
    assert "hamza@example.com" in mime["To"]


def test_scopes_are_readonly_and_compose_only():
    assert [s.rsplit("/", 1)[1] for s in SCOPES] == ["gmail.readonly", "gmail.compose"]


def test_codebase_never_sends_mail():
    forbidden = re.compile(r"\.send\s*\(|send_message|smtplib|gmail\.send|mail\.google\.com/|\.send\b\s*\(")
    files = [p for p in [ROOT / "agent.py", *(ROOT / "app").glob("*.py")]]
    assert [p.name for p in files if forbidden.search(p.read_text(encoding="utf-8"))] == []
