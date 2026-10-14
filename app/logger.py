import json
from datetime import datetime, timezone
from pathlib import Path


def log_step(logs: Path, email_id: str, step: int, decided_by: str, action: str, reason: str,
             args: dict | None = None, result: str = "", latency_ms: int = 0) -> None:
    """One JSONL line per step plus a readable console line. Never log secrets."""
    row = {"ts": datetime.now(timezone.utc).isoformat(), "email_id": email_id, "step": step,
           "decided_by": decided_by, "provider": "gemini", "action": action, "reason": reason,
           "args": args or {}, "result": result, "latency_ms": latency_ms}
    logs.mkdir(parents=True, exist_ok=True)
    with (logs / f"{email_id}.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"{email_id} · step {step} · {decided_by} · {action} · {reason}", flush=True)
