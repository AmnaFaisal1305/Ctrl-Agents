"""Hard and soft checks on a submitted record (ARCHITECTURE.md section 7)."""
import re

from app.config import WORD_LIMIT
from app.models import EmailIn, Issue, OutboxRecord
from app.policy import Policy

_CONTACT = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+|https?://\S+|www\.\S+|\+?\d[\d\s-]{6,}\d")
SIGN_OFF = "Student Helpdesk"


def _hard(code: str, message: str) -> Issue:
    return Issue(severity="hard", code=code, message=message)


def validate(record: OutboxRecord, email: EmailIn, policy: Policy, looked_up_codes: list[str]) -> list[Issue]:
    issues: list[Issue] = []
    reply = record.reply_draft
    if len(reply.split()) >= WORD_LIMIT:
        issues.append(_hard("WORD_LIMIT", f"reply_draft has {len(reply.split())} words; it must be under {WORD_LIMIT}."))
    if not reply.rstrip().endswith(SIGN_OFF):
        issues.append(_hard("SIGN_OFF", f"reply_draft must end with the sign-off '{SIGN_OFF}'."))
    for code in record.policy_refs:
        if code not in policy.by_code:
            issues.append(_hard("UNKNOWN_CODE", f"{code} does not exist in the policy."))
        elif not code.startswith("ESC-") and code not in looked_up_codes:
            issues.append(_hard("NOT_LOOKED_UP", f"{code} was not returned by lookup_policy; look it up first or drop it."))
    if record.policy_refs and not any(c in reply for c in record.policy_refs):
        issues.append(_hard("CODE_NOT_IN_REPLY", "Mention at least one policy code from policy_refs in reply_draft."))
    # shortcut: only checks the reason is non-empty, not that it names an office; upgrade if evals show vague reasons
    if record.escalate and not record.escalation_reason.strip():
        issues.append(_hard("ESCALATION_REASON", "escalate is true: escalation_reason must name the rule and the office."))
    if not record.escalate and record.escalation_reason.strip():
        issues.append(_hard("ESCALATION_REASON", "escalate is false: escalation_reason must be empty."))
    allowed = (" ".join(c.text for c in policy.clauses) + f" {email.subject} {email.body}").lower()
    for found in _CONTACT.findall(reply):
        if found.lower().rstrip(".,") not in allowed:
            issues.append(_hard("INVENTED_CONTACT", f"'{found}' is not in the policy or the email; remove it."))
    body = email.body.strip()
    if "..." in reply or (len(body) > 40 and body[:60].lower() in reply.lower()):
        issues.append(_hard("TEMPLATE_OR_COPY", "reply_draft has leftover '...' or copies the incoming email."))
    first = (email.from_name.split() or ["Student"])[0]
    if first.lower() not in reply[:80].lower():
        issues.append(Issue(severity="soft", code="GREETING", message=f"Greeting should use the name '{first}'."))
    if not 1 <= len(record.agent_notes) <= 400:
        issues.append(Issue(severity="soft", code="NOTES_LENGTH", message="agent_notes must be 1 to 400 characters."))
    return issues
