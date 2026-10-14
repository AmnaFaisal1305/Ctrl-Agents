import html
import json
import re
from pathlib import Path

from app.config import BODY_LIMIT
from app.models import EmailIn

_TAG = re.compile(r"<[^>]+>")
_FIELDS = ("from_name", "from_email", "subject", "body", "received_at")


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", text))).strip()


def load_email(path: Path) -> EmailIn:
    """Never raises: a bad file becomes an empty EmailIn carrying the reason."""
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        return EmailIn(id=path.stem, load_warnings=[f"unreadable file: {exc}"])
    if not isinstance(data, dict):
        return EmailIn(id=path.stem, load_warnings=["JSON is not an object"])
    warnings: list[str] = []
    fields: dict[str, str] = {}
    for key in _FIELDS:
        value = data.get(key)
        if not isinstance(value, str):
            warnings.append(f"missing {key}" if key not in data else f"{key} is not text")
            value = ""
        fields[key] = clean_text(value) if key in ("subject", "body") else value
    if len(fields["body"]) > BODY_LIMIT:
        fields["body"] = fields["body"][:BODY_LIMIT]
        warnings.append(f"body truncated to {BODY_LIMIT} characters")
    email_id = data.get("id")
    if not isinstance(email_id, str) or not email_id.strip():
        email_id = path.stem
        warnings.append("missing id; used filename")
    return EmailIn(id=email_id, load_warnings=warnings, **fields)


def load_inbox(inbox: Path) -> list[EmailIn]:
    return [load_email(p) for p in sorted(inbox.glob("*.json"))]
