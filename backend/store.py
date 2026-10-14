"""SQLite store for the backend (stdlib only). The CLI stays file-based; this is the web demo's state.

Free hosts wipe the disk on restart, so an empty database is seeded from the repo samples
(data/inbox/E*.json, samples/outbox.json, samples/logs/*.jsonl): the dashboard is full with zero LLM calls.
"""
import json
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS emails(id TEXT PRIMARY KEY, raw TEXT NOT NULL, seq INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS records(email_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS steps(email_id TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS steps_by_email ON steps(email_id, seq);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


class Store:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(_SCHEMA)

    def _db(self) -> sqlite3.Connection:
        # one short-lived connection per call: safe across the request, run and SSE threads
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        return db

    def _exec(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        with closing(self._db()) as db, db:  # `with db` commits or rolls back
            return db.execute(sql, args).fetchall()

    # ---- emails (raw JSON text of the inbox file, parsed by app.loader.email_from_text) -------------
    def put_email(self, email_id: str, raw: str) -> None:
        self._exec("INSERT INTO emails(id, raw, seq) VALUES(?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM emails)) "
                   "ON CONFLICT(id) DO UPDATE SET raw=excluded.raw", (email_id, raw))

    def email_raw(self, email_id: str) -> str | None:
        rows = self._exec("SELECT raw FROM emails WHERE id=?", (email_id,))
        return rows[0]["raw"] if rows else None

    def emails_raw(self) -> list[tuple[str, str]]:
        return [(r["id"], r["raw"]) for r in self._exec("SELECT id, raw FROM emails ORDER BY id")]

    def email_count(self) -> int:
        return self._exec("SELECT COUNT(*) AS n FROM emails")[0]["n"]

    def delete_email(self, email_id: str) -> None:
        with closing(self._db()) as db, db:
            for table, col in (("emails", "id"), ("records", "email_id"), ("steps", "email_id")):
                db.execute(f"DELETE FROM {table} WHERE {col}=?", (email_id,))
            db.execute("DELETE FROM meta WHERE key=?", (f"seen:{email_id}",))

    # ---- records (the 9-field outbox rows) --------------------------------------------------------
    def put_record(self, row: dict) -> None:
        self._exec("INSERT INTO records(email_id, data) VALUES(?, ?) ON CONFLICT(email_id) DO UPDATE SET data=excluded.data",
                   (row["email_id"], json.dumps(row, ensure_ascii=False)))

    def records(self) -> dict[str, dict]:
        return {r["email_id"]: json.loads(r["data"]) for r in self._exec("SELECT email_id, data FROM records ORDER BY email_id")}

    # ---- steps (one run's log lines per email) ----------------------------------------------------
    def set_steps(self, email_id: str, rows: list[dict]) -> None:
        with closing(self._db()) as db, db:
            db.execute("DELETE FROM steps WHERE email_id=?", (email_id,))
            db.executemany("INSERT INTO steps(email_id, seq, data) VALUES(?, ?, ?)",
                           [(email_id, i, json.dumps(r, ensure_ascii=False)) for i, r in enumerate(rows)])

    def steps(self, email_id: str) -> list[dict]:
        return [json.loads(r["data"]) for r in self._exec("SELECT data FROM steps WHERE email_id=? ORDER BY seq", (email_id,))]

    def all_steps(self) -> dict[str, list[dict]]:
        out: dict[str, list[dict]] = {}
        for r in self._exec("SELECT email_id, data FROM steps ORDER BY email_id, seq"):
            out.setdefault(r["email_id"], []).append(json.loads(r["data"]))
        return out

    # ---- meta: seen hashes, Gmail draft ids, daily LLM counter ------------------------------------
    def get_meta(self, key: str, default=None):
        rows = self._exec("SELECT value FROM meta WHERE key=?", (key,))
        return json.loads(rows[0]["value"]) if rows else default

    def set_meta(self, key: str, value) -> None:
        self._exec("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                   (key, json.dumps(value)))

    def llm_calls_today(self) -> int:
        return int(self.get_meta(f"llm:{date.today().isoformat()}", 0))

    def add_llm_calls(self, n: int) -> None:
        if n:
            key = f"llm:{date.today().isoformat()}"
            self._exec("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+?",
                       (key, json.dumps(n), n))

    # ---- seeding ----------------------------------------------------------------------------------
    def seed(self, inbox: Path, samples: Path) -> int:
        """Fill an empty database from the repo samples. Returns the number of emails seeded."""
        if self.email_count():
            return 0
        for path in sorted(inbox.glob("E*.json")):
            self.put_email(path.stem, path.read_text(encoding="utf-8-sig"))
        try:
            rows = json.loads((samples / "outbox.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            rows = []
        ids = {i for i, _ in self.emails_raw()}
        for row in rows:
            if isinstance(row, dict) and row.get("email_id") in ids:
                self.put_record(row)
        for log in sorted((samples / "logs").glob("*.jsonl")):
            if log.stem in ids:
                self.set_steps(log.stem, read_jsonl(log))
        return len(ids)


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except ValueError:
            continue
    return rows
