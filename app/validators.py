"""Hard and soft checks on a submitted record (ARCHITECTURE.md section 7). Implemented in P0.2."""
from app.models import EmailIn, Issue, OutboxRecord
from app.policy import Policy


def validate(record: OutboxRecord, email: EmailIn, policy: Policy, looked_up_codes: list[str]) -> list[Issue]:
    raise NotImplementedError("P0.2")
