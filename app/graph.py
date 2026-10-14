"""LangGraph StateGraph: agent <-> tools, agent -> submit(validate) -> end, else fallback."""
import re
import time
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from app.config import MAX_STEPS
from app.fallback import fallback_record
from app.logger import log_step
from app.models import EmailIn, GraphState, OutboxRecord
from app.policy import Policy
from app.reflect import critique
from app.prompts import build_email_block, build_system_prompt, context_meta
from app.safety import post_check, preflags
from app.tools import lookup_policy
from app.validators import validate

MAX_REVISIONS = 2
_CODE = re.compile(r"^([A-Z]+-\d+):", re.M)


def _calls(state: GraphState) -> list[dict]:
    last = state["messages"][-1]
    return last.tool_calls if isinstance(last, AIMessage) else []


def _tokens(ai: AIMessage) -> dict:
    u = getattr(ai, "usage_metadata", None) or {}
    return {k: u[k] for k in ("input_tokens", "output_tokens") if k in u}


def _tool_replies(calls: list[dict], first_result: str) -> list[ToolMessage]:
    """Answer the first call; extra parallel calls are refused (one tool per turn)."""
    out = [ToolMessage(first_result, tool_call_id=calls[0]["id"])]
    out += [ToolMessage("Ignored: one tool call per turn.", tool_call_id=c["id"]) for c in calls[1:]]
    return out


def build_graph(model, policy: Policy, logs: Path):
    def step_no(state: GraphState) -> int:
        return state["llm_calls"]

    def agent(state: GraphState) -> dict:
        eid, t0 = state["email"].id, time.monotonic()
        ai = model.invoke(state["messages"])
        n = state["llm_calls"] + 1
        ms = int((time.monotonic() - t0) * 1000)
        if not ai.tool_calls:
            log_step(logs, eid, n, "model", "no_tool_call", "model returned no tool call", latency_ms=ms, meta=_tokens(ai))
            return {"messages": [ai, HumanMessage("Call exactly one tool.")], "llm_calls": n}
        c = ai.tool_calls[0]
        args = {k: v for k, v in c["args"].items() if k != "reason"}
        log_step(logs, eid, n, "model", c["name"], c["args"].get("reason", ""), args=args if c["name"] != "Submit" else {}, latency_ms=ms, meta=_tokens(ai))
        return {"messages": [ai], "llm_calls": n}

    def tools(state: GraphState) -> dict:
        call = _calls(state)[0]
        a = call["args"]
        text = lookup_policy(policy, a.get("section", ""), a.get("codes") or None, a.get("query", ""))
        found = _CODE.findall(text)
        log_step(logs, state["email"].id, step_no(state), "rule", "lookup_result", f"returned {', '.join(found) or 'nothing'}",
                 meta={"codes": found, "chars": len(text)})
        return {"messages": _tool_replies(_calls(state), text), "looked_up_codes": state["looked_up_codes"] + found}

    def submit(state: GraphState) -> dict:
        email, calls = state["email"], _calls(state)
        fields = {k: v for k, v in calls[0]["args"].items() if k in OutboxRecord.model_fields and k != "email_id"}
        try:
            record = OutboxRecord(email_id=email.id, **fields)
            issues = validate(record, email, policy, state["looked_up_codes"])
        except ValidationError as exc:
            record, issues = None, [f"schema invalid: {exc.errors()[0]['msg']} ({exc.errors()[0]['loc']})"]
        hard = [i if isinstance(i, str) else f"{i.code}: {i.message}" for i in issues if isinstance(i, str) or i.severity == "hard"]
        if record and not hard:
            if any(i.severity == "soft" for i in issues):  # section 6.6: unresolved soft issue caps confidence
                record = record.model_copy(update={"confidence": min(record.confidence, 0.6)})
            log_step(logs, email.id, step_no(state), "rule", "validate", "accepted", result=", ".join(i.code for i in issues))
            return {"messages": _tool_replies(calls, "ok"), "record": record}
        log_step(logs, email.id, step_no(state), "rule", "validate", "rejected: " + "; ".join(hard))
        msg = "Submit rejected. Fix these and submit again:\n" + "\n".join(hard)
        return {"messages": _tool_replies(calls, msg), "revisions": state["revisions"] + 1}

    def fail(state: GraphState) -> dict:
        reason = "step budget used" if state["llm_calls"] >= MAX_STEPS else "validation failed after 2 revisions"
        log_step(logs, state["email"].id, step_no(state), "rule", "fallback", reason)
        return {"record": fallback_record(state["email"], reason)}

    def after_agent(state: GraphState) -> str:
        calls = _calls(state)
        if not calls:
            return "agent" if state["llm_calls"] < MAX_STEPS else "fail"
        return "submit" if calls[0]["name"] == "Submit" else "tools"

    def after_act(state: GraphState) -> str:
        if state["record"]:
            return END
        return "fail" if state["revisions"] >= MAX_REVISIONS or state["llm_calls"] >= MAX_STEPS else "agent"

    g = StateGraph(GraphState)
    for name, fn in (("agent", agent), ("tools", tools), ("submit", submit), ("fail", fail)):
        g.add_node(name, fn)
    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", after_agent, ["agent", "tools", "submit", "fail"])
    g.add_conditional_edges("tools", after_act, ["agent", "fail"])
    g.add_conditional_edges("submit", after_act, [END, "agent", "fail"])
    g.add_edge("fail", END)
    return g.compile()


def _reflect(email: EmailIn, record: OutboxRecord, policy: Policy, critic, logs: Path, looked_up: list[str]) -> int:
    """Shadow review of the final record: logged, never applied. Returns the LLM calls used."""
    t0 = time.monotonic()
    try:
        result, tokens = critique(email, record, policy, critic, looked_up)
    except Exception as exc:  # the critic must never break a row
        log_step(logs, email.id, 0, "rule", "reflect_failed", f"critic failed: {type(exc).__name__}")
        return 0
    issues = [i.model_dump() for i in result.issues]
    reason = "critic: ok" if result.verdict == "ok" else f"critic: {len(issues)} concern(s): " + ", ".join(i["aspect"] for i in issues)
    log_step(logs, email.id, 0, "model", "reflect", reason, latency_ms=int((time.monotonic() - t0) * 1000),
             meta={"verdict": result.verdict, "issues": issues, **tokens})
    return 1


def run_email(email: EmailIn, model, policy: Policy, logs: Path, critic=None) -> tuple[OutboxRecord, int]:
    """Run the graph for one email. Returns (record, llm_calls). Never raises. `critic` enables the shadow review."""
    (logs / f"{email.id}.jsonl").unlink(missing_ok=True)  # one log per run, so the timeline is never mixed with old runs
    if not (email.body.strip() or email.subject.strip()):
        reason = "; ".join(email.load_warnings) or "no usable text"
        log_step(logs, email.id, 0, "rule", "fallback", reason)
        return fallback_record(email, reason), 0
    hints = preflags(email)
    meta = context_meta(policy, email, hints)
    log_step(logs, email.id, 0, "rule", "context", f"context built: about {meta['approx_tokens']} tokens, {len(hints)} hint(s)", meta=meta)
    state: GraphState = {
        "email": email,
        "messages": [SystemMessage(build_system_prompt(policy)), HumanMessage(build_email_block(email, hints))],
        "looked_up_codes": [], "revisions": 0, "record": None, "llm_calls": 0,
    }
    try:
        final = build_graph(model, policy, logs).invoke(state, {"recursion_limit": 25})
        record, forced = post_check(email, final["record"])
        if forced:
            log_step(logs, email.id, final["llm_calls"], "rule", "safety_net", f"forced escalation: {record.escalation_reason}")
        extra = _reflect(email, record, policy, critic, logs, final["looked_up_codes"]) if critic and record.confidence > 0.0 else 0  # not for fallback rows
        return record, final["llm_calls"] + extra
    except Exception as exc:  # fail soft: every email gets a row
        reason = f"{type(exc).__name__}"
        log_step(logs, email.id, 0, "rule", "fallback", f"graph error: {reason}")
        return fallback_record(email, f"LLM or graph error ({reason})"), 0
