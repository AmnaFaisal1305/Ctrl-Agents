"""Pre-flags and the life-safety net for ESC-1 and ESC-3 (P1, ARCHITECTURE.md section 8)."""
from app.models import EmailIn, OutboxRecord


def preflags(email: EmailIn) -> list[str]:
    raise NotImplementedError("P1")


def post_check(email: EmailIn, record: OutboxRecord) -> OutboxRecord:
    raise NotImplementedError("P1")
