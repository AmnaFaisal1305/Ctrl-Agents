import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
MAX_STEPS = 6
WORD_LIMIT = 150
BODY_LIMIT = 4000


@dataclass(frozen=True)
class Settings:
    inbox: Path
    outbox: Path
    policy: Path
    logs: Path
    model: str
    workers: int
    use_cache: bool


def load_settings() -> Settings:
    load_dotenv(ROOT / ".env")
    return Settings(
        inbox=ROOT / "data" / "inbox",
        outbox=ROOT / "outbox.json",
        policy=ROOT / "data" / "policy.md",
        logs=ROOT / "logs",
        model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
        workers=int(os.getenv("WORKERS", "2")),
        use_cache=os.getenv("USE_CACHE", "0") == "1",
    )
