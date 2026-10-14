"""System prompt and per-step prompt builders (P0.2, ARCHITECTURE.md 6.2 to 6.6)."""
from app.models import EmailIn
from app.policy import Policy


def build_system_prompt(policy: Policy) -> str:
    raise NotImplementedError("P0.2")


def build_email_block(email: EmailIn) -> str:
    raise NotImplementedError("P0.2")
