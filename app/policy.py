import re
from dataclasses import dataclass
from pathlib import Path

_CLAUSE = re.compile(r"^- ([A-Z]+-\d+): (.+)$")
_WORD = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class Clause:
    code: str
    section: str
    text: str


class Policy:
    def __init__(self, clauses: list[Clause]) -> None:
        self.clauses = clauses
        self.by_code = {c.code: c for c in clauses}

    @classmethod
    def parse(cls, path: Path) -> "Policy":
        clauses: list[Clause] = []
        section = ""
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                section = line[3:].strip()
            elif m := _CLAUSE.match(line.strip()):
                clauses.append(Clause(m.group(1), section, m.group(2)))
        return cls(clauses)

    def sections(self) -> list[str]:
        return list(dict.fromkeys(c.section for c in self.clauses))

    def section(self, name: str) -> list[Clause]:
        return [c for c in self.clauses if c.section.lower() == name.lower()]

    def lookup(self, section: str = "", codes: list[str] | None = None, query: str = "") -> list[Clause]:
        if codes:
            return [self.by_code[c] for c in codes if c in self.by_code]
        if section:
            return self.section(section)
        words = set(_WORD.findall(query.lower()))
        scored = [(len(words & set(_WORD.findall(c.text.lower()))), c) for c in self.clauses]
        hits = [c for score, c in sorted(scored, key=lambda t: -t[0]) if score > 0][:3]
        if hits:
            return hits
        # shortcut: no keyword overlap at all (typos, Roman Urdu) returns nothing; upgrade to embeddings if evals show misses
        return []
