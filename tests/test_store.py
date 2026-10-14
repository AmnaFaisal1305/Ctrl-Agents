import json

from app.config import ROOT
from backend.store import Store


def test_seed_fills_an_empty_database_once_from_the_samples(tmp_path):
    store = Store(tmp_path / "s.db")
    n = store.seed(ROOT / "data" / "inbox", ROOT / "samples")
    assert n >= 20 and store.email_count() == n
    rows = store.records()
    assert len(rows) >= 20 and all(set(r) == {"email_id", "category", "priority", "escalate", "escalation_reason",
                                                "policy_refs", "reply_draft", "confidence", "agent_notes"} for r in rows.values())
    assert store.steps("E001")  # sample logs came along, so the timeline works with zero LLM calls
    assert store.seed(ROOT / "data" / "inbox", ROOT / "samples") == 0  # never overwrites a populated database


def test_round_trip_steps_meta_and_delete(tmp_path):
    store = Store(tmp_path / "s.db")
    store.put_email("web-1", json.dumps({"id": "web-1", "body": "hi"}))
    store.put_record({"email_id": "web-1", "category": "fee"})
    store.set_steps("web-1", [{"step": 1}, {"step": 2}])
    store.set_steps("web-1", [{"step": 9}])  # replaced, not appended
    store.set_meta("seen:web-1", "abc")
    assert store.steps("web-1") == [{"step": 9}] and store.records()["web-1"]["category"] == "fee"
    store.add_llm_calls(2)
    store.add_llm_calls(3)
    assert store.llm_calls_today() == 5
    store.delete_email("web-1")
    assert store.email_raw("web-1") is None and store.records() == {} and store.steps("web-1") == []
    assert store.get_meta("seen:web-1") is None
