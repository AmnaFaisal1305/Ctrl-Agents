from langchain_core.messages import AIMessage

from app.config import ROOT
from app.graph import run_email
from app.models import EmailIn
from app.policy import Policy
from app.validators import validate

POLICY = Policy.parse(ROOT / "data" / "policy.md")
EMAIL = EmailIn(id="T1", from_name="Sara Ali", subject="Late fee", body="Please waive my late fee, I paid late.")


class FakeModel:
    """Replays scripted tool calls; no network."""

    def __init__(self, calls: list[tuple[str, dict]]) -> None:
        self.calls, self.i = calls, 0

    def invoke(self, messages):
        name, args = self.calls[min(self.i, len(self.calls) - 1)]
        self.i += 1
        return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": f"c{self.i}"}])


def submit_args(**over) -> dict:
    base = dict(reason="r", category="fee", priority="medium", escalate=False, escalation_reason="",
                policy_refs=["FEE-2"], confidence=0.8, agent_notes="n",
                reply_draft="Dear Sara, the helpdesk cannot waive late fees (FEE-2). Please apply to the Accounts Office with proof. Student Helpdesk")
    return {**base, **over}


def test_lookup_then_submit_accepts(tmp_path):
    model = FakeModel([("LookupPolicy", {"reason": "fees", "section": "Fees"}), ("Submit", submit_args())])
    rec, calls = run_email(EMAIL, model, POLICY, tmp_path)
    assert calls == 2 and rec.category == "fee" and rec.confidence == 0.8
    assert (tmp_path / "T1.jsonl").exists()


def test_unlooked_code_is_rejected_then_fixed(tmp_path):
    model = FakeModel([("Submit", submit_args()), ("LookupPolicy", {"reason": "x", "codes": ["FEE-2"]}), ("Submit", submit_args())])
    rec, calls = run_email(EMAIL, model, POLICY, tmp_path)
    assert calls == 3 and rec.policy_refs == ["FEE-2"]


def test_two_bad_submits_fall_back(tmp_path):
    model = FakeModel([("Submit", submit_args(reply_draft="no sign off"))])
    rec, _ = run_email(EMAIL, model, POLICY, tmp_path)
    assert rec.confidence == 0.0 and rec.escalate


def test_model_that_only_looks_up_hits_step_budget(tmp_path):
    rec, calls = run_email(EMAIL, FakeModel([("LookupPolicy", {"reason": "x", "section": "Fees"})]), POLICY, tmp_path)
    assert calls == 6 and rec.confidence == 0.0


def test_empty_email_makes_no_llm_call(tmp_path):
    rec, calls = run_email(EmailIn(id="T2"), FakeModel([]), POLICY, tmp_path)
    assert calls == 0 and rec.confidence == 0.0


def test_llm_exception_falls_back(tmp_path):
    class Boom:
        def invoke(self, messages):
            raise RuntimeError("429")

    rec, calls = run_email(EMAIL, Boom(), POLICY, tmp_path)
    assert rec.confidence == 0.0 and calls == 0


def test_validator_flags_invented_contact_and_long_reply():
    from app.models import OutboxRecord

    rec = OutboxRecord(email_id="T1", category="fee", priority="low", escalate=False, policy_refs=[], confidence=0.5,
                       agent_notes="n", reply_draft="Dear Sara call 0300-1234567 now. " + "word " * 150 + "Student Helpdesk")
    codes = {i.code for i in validate(rec, EMAIL, POLICY, [])}
    assert {"INVENTED_CONTACT", "WORD_LIMIT"} <= codes
