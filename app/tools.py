"""Agent tools. lookup_policy runs in the tools node; Submit is validated in the submit node (graph.py)."""
from typing import Literal

from pydantic import BaseModel, Field

from app.models import EmailIn
from app.policy import Policy


class LookupPolicy(BaseModel):
    """Look up policy clauses. Give exactly one of section, codes or query."""

    reason: str = Field(description="One or two sentences: why this lookup.")
    section: str = Field(default="", description="One of: Fees, Hostel, Academics, Technical.")
    codes: list[str] = Field(default_factory=list, description="Exact clause codes, e.g. ['FEE-2'].")
    query: str = Field(default="", description="Free-text keywords, e.g. 'late fee'.")


class Submit(BaseModel):
    """Submit the final triage record for this email. Ends the task if valid."""

    reason: str = Field(description="One or two sentences: why this category, priority and reply.")
    category: str
    priority: Literal["low", "medium", "high"]
    escalate: bool
    escalation_reason: str = Field(default="", description="Empty if escalate is false; else rule and office.")
    policy_refs: list[str] = Field(default_factory=list)
    reply_draft: str
    confidence: float = Field(ge=0.0, le=1.0)
    agent_notes: str


TOOLS = [LookupPolicy, Submit]


def lookup_policy(policy: Policy, section: str = "", codes: list[str] | None = None, query: str = "") -> str:
    clauses = policy.lookup(section=section, codes=codes, query=query)
    if not clauses:
        return f"No matching clause. Try section= one of {policy.sections()} or other keywords."
    return "\n".join(f"{c.code}: {c.text}" for c in clauses)


def find_related_emails(inbox: list[EmailIn], from_email: str) -> str:
    raise NotImplementedError("P1")
