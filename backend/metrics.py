"""Aggregate observability numbers from the step logs (logs/<id>.jsonl). Read-only, no LLM, no I/O."""
import math
import re
from collections import Counter

_MODEL_ACTIONS = {"LookupPolicy", "Submit", "no_tool_call"}
_CODES = re.compile(r"(?:^|; )([A-Z][A-Z_]+):")


def _pct(values: list[int], q: float) -> int:
    """Nearest-rank percentile; 0 for no data."""
    if not values:
        return 0
    s = sorted(values)
    return s[max(0, math.ceil(q * len(s)) - 1)]


def _tokens(rows: list[dict]) -> tuple[int, int]:
    meta = [r.get("meta") or {} for r in rows]
    return sum(m.get("input_tokens", 0) for m in meta), sum(m.get("output_tokens", 0) for m in meta)


def email_summary(email_id: str, rows: list[dict]) -> dict:
    """One row of the per-email table."""
    model = [r for r in rows if r.get("action") in _MODEL_ACTIONS]
    validates = [r for r in rows if r.get("action") == "validate"]
    rejected = [r for r in validates if str(r.get("reason", "")).startswith("rejected")]
    actions = {r.get("action") for r in rows}
    reflect = next((r for r in rows if r.get("action") == "reflect"), None)
    tin, tout = _tokens(rows)
    outcome = "fallback" if "fallback" in actions else "safety_net" if "safety_net" in actions else "accepted"
    ctx = next((r.get("meta") or {} for r in rows if r.get("action") == "context"), {})
    return {"email_id": email_id, "model_calls": len(model), "latency_ms": sum(r.get("latency_ms", 0) for r in rows),
            "input_tokens": tin, "output_tokens": tout, "outcome": outcome, "rejections": len(rejected),
            "self_healed": bool(rejected) and outcome != "fallback",
            "context_tokens": ctx.get("approx_tokens", 0), "hints": ctx.get("hints", []),
            "critic": (reflect.get("meta") or {}).get("verdict") if reflect else ("failed" if "reflect_failed" in actions else None)}


def aggregate(logs: dict[str, list[dict]]) -> dict:
    """`logs` maps email id to its step rows. Returns the numbers behind the Observability page."""
    all_rows = [r for rows in logs.values() for r in rows]
    model_ms = [r.get("latency_ms", 0) for r in all_rows if r.get("action") in _MODEL_ACTIONS]
    reflect_ms = [r.get("latency_ms", 0) for r in all_rows if r.get("action") == "reflect"]
    tool_use = Counter(r["action"] for r in all_rows if r.get("decided_by") == "model")
    rejections = Counter(code for r in all_rows if r.get("action") == "validate" and str(r.get("reason", "")).startswith("rejected")
                         for code in _CODES.findall(str(r["reason"])[len("rejected: "):]))
    per_email = [email_summary(i, rows) for i, rows in sorted(logs.items())]
    n = len(per_email)
    critic = Counter(e["critic"] for e in per_email if e["critic"])
    aspects = Counter(i.get("aspect", "?") for r in all_rows if r.get("action") == "reflect" for i in (r.get("meta") or {}).get("issues", []))
    tin, tout = _tokens(all_rows)
    return {
        "emails": n,
        "llm_calls": len([r for r in all_rows if r.get("action") in _MODEL_ACTIONS or r.get("action") == "reflect"]),
        "input_tokens": tin, "output_tokens": tout,
        "latency_ms": {"p50": _pct(model_ms, 0.5), "p95": _pct(model_ms, 0.95), "critic_p50": _pct(reflect_ms, 0.5)},
        "tool_usage": dict(tool_use),
        "outcomes": dict(Counter(e["outcome"] for e in per_email)),
        "recovery": {"rejections_by_code": dict(rejections), "self_healed": sum(e["self_healed"] for e in per_email),
                     "fallbacks": sum(e["outcome"] == "fallback" for e in per_email),
                     "safety_net": sum(e["outcome"] == "safety_net" for e in per_email)},
        "critic": {"verdicts": dict(critic), "aspects": dict(aspects)},
        "context": {"avg_tokens": round(sum(e["context_tokens"] for e in per_email) / n) if n else 0,
                    "hinted_emails": sum(bool(e["hints"]) for e in per_email),
                    "truncated_emails": sum(1 for rows in logs.values() for r in rows
                                            if r.get("action") == "context" and (r.get("meta") or {}).get("truncated"))},
        "per_email": per_email,
    }
