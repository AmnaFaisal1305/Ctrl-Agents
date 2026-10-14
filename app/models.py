from typing import Annotated, Literal, TypedDict

from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class EmailIn(BaseModel):
    id: str
    from_name: str = ""
    from_email: str = ""
    subject: str = ""
    body: str = ""
    received_at: str = ""
    load_warnings: list[str] = Field(default_factory=list)  # not written to outbox


class OutboxRecord(BaseModel):
    email_id: str
    category: str
    priority: Literal["low", "medium", "high"]
    escalate: bool
    escalation_reason: str = ""
    policy_refs: list[str] = Field(default_factory=list)
    reply_draft: str
    confidence: float = Field(ge=0.0, le=1.0)
    agent_notes: str


class AgentStep(BaseModel):
    action: Literal["lookup_policy", "find_related_emails", "submit"]
    reason: str  # logged verbatim; one or two sentences
    args: dict = Field(default_factory=dict)


class Issue(BaseModel):
    severity: Literal["hard", "soft"]
    code: str  # e.g. "WORD_LIMIT"
    message: str  # fed back to the model verbatim


class GraphState(TypedDict):
    email: EmailIn
    messages: Annotated[list, add_messages]  # LangChain message history
    looked_up_codes: list[str]  # codes returned by lookup_policy this run
    revisions: int  # failed submits so far (max 2)
    record: OutboxRecord | None
    llm_calls: int
