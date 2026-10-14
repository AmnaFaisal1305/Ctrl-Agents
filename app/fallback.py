from app.models import EmailIn, OutboxRecord


def fallback_record(email: EmailIn, reason: str) -> OutboxRecord:
    """Safe holding row for any failure (ARCHITECTURE.md 5.4). Promises nothing."""
    name = email.from_name.split()[0] if email.from_name.strip() else "Student"
    return OutboxRecord(
        email_id=email.id,
        category="other",
        priority="high",
        escalate=True,
        escalation_reason=f"Automated processing failed ({reason}); needs a human at the Helpdesk",
        policy_refs=[],
        reply_draft=(
            f"Dear {name}, thank you for contacting us. We have received your message and a member "
            "of staff will review it and reply with the next step. Student Helpdesk"
        ),
        confidence=0.0,
        agent_notes=f"Fallback record: {reason}",
    )
