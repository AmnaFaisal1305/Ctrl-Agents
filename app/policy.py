import re
from dataclasses import dataclass
from pathlib import Path

_CLAUSE = re.compile(r"^- ([A-Z]+-\d+): (.+)$")
_WORD = re.compile(r"[a-z0-9]+")
_STOP = {"the", "and", "for", "can", "how", "what", "when", "does", "with", "that", "this", "are", "you", "not", "any", "from", "have"}


def _tokens(text: str) -> set[str]:
    """Lowercase words minus stopwords, with a trailing plural 's' removed (installments ~ installment)."""
    return {w[:-1] if len(w) > 3 and w.endswith("s") else w for w in _WORD.findall(text.lower()) if w not in _STOP}


@dataclass(frozen=True)
class Clause:
    code: str
    section: str
    text: str


class Policy:
    def __init__(self, clauses: list[Clause], raw_sections: dict[str, str] | None = None) -> None:
        self.clauses = clauses
        self.raw_sections = raw_sections or {}  # section name -> its bullet lines verbatim
        self.by_code = {c.code: c for c in clauses}

    @classmethod
    def parse(cls, path: Path) -> "Policy":
        clauses: list[Clause] = []
        section = ""
        raw: dict[str, list[str]] = {}
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                section = line[3:].strip()
            elif line.startswith("- "):
                raw.setdefault(section, []).append(line.strip())
                if m := _CLAUSE.match(line.strip()):
                    clauses.append(Clause(m.group(1), section, m.group(2)))
        return cls(clauses, {k: "\n".join(v) for k, v in raw.items()})

    def sections(self) -> list[str]:
        return list(dict.fromkeys(c.section for c in self.clauses))

    def section(self, name: str) -> list[Clause]:
        return [c for c in self.clauses if c.section.lower() == name.lower()]

    def lookup(self, section: str = "", codes: list[str] | None = None, query: str = "") -> list[Clause]:
        if codes:
            return [self.by_code[c] for c in codes if c in self.by_code]
        if section:
            return self.section(section)
        words = _tokens(query)
        clause_words = [(c, _tokens(c.text)) for c in self.clauses]
        # rare words count more: a word found in few clauses (installments) beats one found everywhere (fee)
        df = {w: sum(w in cw for _, cw in clause_words) for w in words}
        scored = [(sum(1 / df[w] for w in words & cw), c) for c, cw in clause_words]
        hits = [c for score, c in sorted(scored, key=lambda t: -t[0]) if score > 0][:3]
        if hits:
            return hits
        # shortcut: no keyword overlap at all (typos, Roman Urdu) returns nothing; upgrade to embeddings if evals show misses
        return []
