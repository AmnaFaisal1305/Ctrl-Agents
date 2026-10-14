"""Agent tools (P0.2): lookup_policy, find_related_emails (P1). submit is a graph node, see graph.py."""
from app.models import EmailIn
from app.policy import Policy


def lookup_policy(policy: Policy, section: str = "", codes: list[str] | None = None, query: str = "") -> str:
    raise NotImplementedError("P0.2")


def find_related_emails(inbox: list[EmailIn], from_email: str) -> str:
    raise NotImplementedError("P1")
