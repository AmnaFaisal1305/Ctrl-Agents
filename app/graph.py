"""LangGraph StateGraph: preprocess -> agent <-> tools -> submit/validate -> safety -> finalize (P0.2)."""
from app.models import EmailIn, OutboxRecord


def run_email(email: EmailIn) -> OutboxRecord:
    raise NotImplementedError("P0.2")
