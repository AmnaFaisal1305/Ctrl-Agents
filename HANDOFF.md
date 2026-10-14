# HANDOFF.md

Updated at the end of every session. Newest session at the top. Keep it short and factual.

## Session 1b (Gmail)

- Added `app/gmail.py` (OAuth desktop flow, `fetch_inbox`, `create_draft`), `--gmail` and `--no-drafts` in `agent.py`, `tests/test_gmail.py` (fake service; also greps the code for any send call). Gmail deps pinned in `requirements.txt`. Fetched Gmail files and `docs/credentials*` are gitignored.
- OAuth succeeded (`secrets/token.json` created). `python agent.py --gmail --no-drafts` fetched **0** messages for `label:helpdesk`: the label needs test emails.
- Testing-mode token expires after 7 days: delete `secrets/token.json` and re-run if `invalid_grant`.
- Not yet verified against real mail: fetch of a real message, and draft creation (no draft has been created yet; the agent is still a stub, drafts would hold the fallback text).
- Next: put 3 to 5 emails under the `helpdesk` label, run `--gmail --no-drafts`, then one `--gmail` run and check Drafts and Sent in Gmail.

## Session 1 (docs + scaffold)

**Date:** 2026-10-14
**Who:** Ahmed (single-owner workflow)

### Status
- Phase / gate: P0.1 done (skeleton). Next is P0.2 (LLM graph). Gate 1 not yet attempted.
- Tier in progress: P0.

### Done
- Deleted `docs/Mission.md` (stale duplicate of `ARCHITECTURE.md`).
- `ARCHITECTURE.md` rewritten for LangGraph (`graph.py`, `GraphState`, native tool calling), `GOOGLE_API_KEY`, `gemini-2.5-flash`, Gmail section 5.5, single owner; change-log line added.
- `CLAUDE.md`: skills/MCP tables fixed, Gmail exception to rule 4, single-owner rule, no superpowers skills.
- Skeleton created. Real code: `models`, `config`, `loader`, `policy`, `fallback`, `writer`, `logger`, `agent.py` (stub agent returning fallback rows). Typed stubs (raise `NotImplementedError`): `tools`, `validators`, `llm`, `prompts`, `graph`, `safety`.
- `.venv` created, deps installed and pinned in `requirements.txt`; `.gitignore`, `.env.example`, `README.md` skeleton, `tests/test_scaffold.py`.

### In progress
- Nothing.

### Next steps (in order)
1. Put `GOOGLE_API_KEY` in `.env` (user). Look up current `langgraph` / `langchain-google-genai` docs (Context7, langchain skills) and confirm `gemini-2.5-flash` is a valid model ID.
2. P0.2: `llm.py`, `prompts.py`, `tools.py`, `validators.py`, `graph.py`; Gate 1 on E001 and E002 (single emails only).
3. Gmail (ARCHITECTURE 5.5): follow the OAuth steps in the plan (`C:\Users\ahmed\.claude\plans\dynamic-herding-rainbow.md`), place `secrets/credentials.json`, add the Gmail dependencies (need approval), write `app/gmail.py` and `--gmail`.
4. Phase 0.3, then P1 to P3 as in `ARCHITECTURE.md` section 9.

### Blockers and open questions
- `GOOGLE_API_KEY` and `secrets/credentials.json` not provided yet.
- Is a team of two approved? Is the API key shared across teams?
- A personal Gmail account was chosen; the narrow label query (`label:helpdesk`) is the mitigation. A dedicated test account is safer.

### Assumptions made
- Model `gemini-2.5-flash`, key variable `GOOGLE_API_KEY` (no `check_env.py` or organizers' `requirements.txt` was available).
- Unreadable or empty email files load as an empty `EmailIn` with `load_warnings`; `agent.py` turns them into fallback rows.
- `app/fallback.py` added as a module (not in the original table); table updated.
- `policy.lookup(query=...)` returns nothing when no keyword overlaps (marked `shortcut:` in the code); the section-similarity fallback from `ARCHITECTURE.md` 6.1 is deferred to P0.2/P1.

### Files touched
`ARCHITECTURE.md`, `CLAUDE.md`, `HANDOFF.md`, `README.md`, `requirements.txt`, `.gitignore`, `.env.example`, `agent.py`, `app/*`, `tests/test_scaffold.py`; deleted `docs/Mission.md`.

### How to run and verify
- `.venv\Scripts\python -m pytest -q`: 9 passed.
- `.venv\Scripts\python agent.py`: 20 rows in `outbox.json`, nine keys each, "LLM calls: 0". A temp inbox with a malformed and an empty file also produced one row each.

### Known issues
- The agent is a stub: every email gets the fallback row.
- `ARCHITECTURE.md` 6.1 says query lookup should fall back to the best-matching section; not implemented yet.

### Notes for the other person
- None; treat as one workflow. Do not use `superpowers:*` skills here.
