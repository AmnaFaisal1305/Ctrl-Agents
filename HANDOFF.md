# HANDOFF.md

Updated at the end of every session. Newest session at the top. Keep it short and factual.

## Session 1 (docs, scaffold, Gmail OAuth)

**Date:** 2026-10-14
**Who:** Ahmed (single-owner workflow; really two people)

### Status
- Phase / gate: P0.1 (skeleton) done. Gmail plumbing written and OAuth authorized. Next is **P0.2** (LLM graph). Gate 1 not attempted.
- Tier in progress: P0.

### Done
- Deleted `docs/Mission.md` (stale duplicate of `ARCHITECTURE.md`).
- `ARCHITECTURE.md` moved to LangGraph (`graph.py`, `GraphState`, native tool calling), `gemini-2.5-flash`, `GOOGLE_API_KEY`, Gmail section 5.5, single owner. `CLAUDE.md`: skills/MCP tables fixed, Gmail exception to the "never send" rule, single-owner rule, no `superpowers:*` skills.
- Real code: `app/models`, `config`, `loader`, `policy`, `fallback`, `writer`, `logger`, `gmail`, and `agent.py` (stub agent: every email gets the fallback row). Typed stubs raising `NotImplementedError`: `tools`, `validators`, `llm`, `prompts`, `graph`, `safety`.
- Gmail: OAuth desktop flow works (`secrets/token.json` created). `--gmail` fetches `GMAIL_QUERY` into `data/inbox/<gmail id>.json`; replies are saved as drafts (ids tracked in `logs/gmail_drafts.json` so re-runs don't duplicate); `--no-drafts` skips drafting. A test fails if any send call appears in the code.
- Deps installed in `.venv` and pinned in `requirements.txt` (langgraph, langchain-core, langchain-google-genai, pydantic, python-dotenv, pytest, google-api-python-client, google-auth, google-auth-httplib2, google-auth-oauthlib).
- `.env` exists with `GOOGLE_API_KEY` set (length checked only; **no Gemini call made yet**).
- Commits: `55f1556` scaffold, `0ddf3ec` Gmail.

### In progress
- Nothing.

### Next steps (in order)
1. **User:** create Gmail label `helpdesk`, add 3 to 5 throwaway test emails to it.
2. Run `python agent.py --gmail --no-drafts` and confirm the messages land in `data/inbox/` and in `outbox.json`. Then one `python agent.py --gmail` run; confirm in Gmail that drafts appear and **Sent is empty**.
3. P0.2: look up current `langgraph` and `langchain-google-genai` docs (Context7, langchain skills `ecosystem-primer`, `langgraph-fundamentals`) and confirm `gemini-2.5-flash` is a valid ID with tool calling. Then write `llm.py`, `prompts.py`, `tools.py`, `validators.py`, `graph.py`. Test on E001 and E002 only (quota).
4. Gate 1, then phase 0.3 (all 20, fix prompts, README approach note), then P1 to P3 per `ARCHITECTURE.md` section 9.
5. Add `--no-drafts`-style dev flags only if needed; do not add features outside the current phase.

### Blockers and open questions
- Gmail label `helpdesk` is empty or missing: fetch returned **0** messages.
- Is a team of two approved? Is the Gemini key shared across teams (429 risk)?
- A personal Gmail is used; mitigation is the narrow `label:helpdesk` query plus readonly + compose scopes. A dedicated test account is safer.
- `docs/credentials` (untracked, now gitignored) is probably a stray copy of the OAuth client file; the user should delete it or move it outside the repo.

### Assumptions made
- Model `gemini-2.5-flash`, key variable `GOOGLE_API_KEY` (no `check_env.py` or organizers' `requirements.txt` was available).
- Bad or empty email files load as an empty `EmailIn` with `load_warnings`; `agent.py` turns them into fallback rows.
- `app/fallback.py` added as a module (table updated). Gmail message id is used as the email `id`.
- `policy.lookup(query=...)` returns nothing when no keyword overlaps (marked `shortcut:`); the best-matching-section fallback from `ARCHITECTURE.md` 6.1 is deferred.
- Drafts are only created for mail fetched in the same `--gmail` run, never for the sample `E*.json` files.

### Files touched
`ARCHITECTURE.md`, `CLAUDE.md`, `HANDOFF.md`, `README.md`, `requirements.txt`, `.gitignore`, `.env.example`, `agent.py`, `app/*`, `tests/test_scaffold.py`, `tests/test_gmail.py`; deleted `docs/Mission.md`. Untracked and intentionally not committed: `.agents/`, `.claude/`, `skills-lock.json`.

### How to run and verify
- `.venv\Scripts\python -m pytest -q`: 14 passed.
- `.venv\Scripts\python agent.py`: 20 fallback rows in `outbox.json`, nine keys each, "LLM calls: 0". A temp inbox with a malformed and an empty file gave one row each.
- `.venv\Scripts\python agent.py --gmail --no-drafts`: OAuth succeeded, "Gmail: fetched 0 messages for query 'label:helpdesk'", then processed the 20 samples. Real message fetch and real draft creation are **unverified**.

### Known issues
- The agent is a stub; every email gets the fallback row, so any drafts would hold the holding text.
- The Testing-mode OAuth token expires after 7 days: if `invalid_grant`, delete `secrets/token.json` and re-run `--gmail`.
- `secrets/` lives inside OneDrive and syncs to the cloud; `SECRETS_DIR` in `.env` can point elsewhere.
- `ARCHITECTURE.md` 6.1 query fallback to the best-matching section is not implemented.

### Notes for the other person
- Treat as one workflow. Do not use `superpowers:*` skills here. Never commit `.env`, `secrets/` or fetched Gmail files (all gitignored).
