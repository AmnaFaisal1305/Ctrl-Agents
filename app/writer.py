import json
import os
import tempfile
from pathlib import Path

from app.models import OutboxRecord


def write_outbox(records: list[OutboxRecord], path: Path) -> None:
    """Atomic write: temp file in the same folder, then rename. Sorted by email_id."""
    rows = [r.model_dump() for r in sorted(records, key=lambda r: r.email_id)]
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise
