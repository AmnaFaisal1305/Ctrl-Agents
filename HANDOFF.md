# HANDOFF.md

Updated at the end of every session. Newest session at the top. Keep it short and factual.

## Session 2 (P0.2 + P0.3 + P1: agent finalized)

**Date:** 2026-10-14

### Status
- **Gate 1, Gate 2 and Gate 3 reached** with real Gemini (`gemini-2.5-flash`, paid key in `.env`). The agent is functionally complete. Remaining: Gmail verification with real mail, optional P2 dashboard and `--watch`, freeze checklist.

### Done
- P0.2: `tools`, `validators`, `prompts`, `llm`, `graph` (agent / tools / submit / fail nodes, 6 turns, 2 revisions, then fallback). `agent.py` runs it, prints the real LLM call count, and falls back per email on any error.
- P0.3: all 20 samples run; every reply read by hand; prompt and validator tuned (ESC code required in `escalation_reason`, no markdown, Roman Urdu replies, no unsupported promises, look up every issue, ESC-3 only for real distress).
- P1: `app/safety.py` (advisory pre-flags for hazard, wellbeing, injection; life-safety net forces `escalate` + high priority, logged as `decided_by: rule`), `--only-new` (hashes in `logs/seen.json`), `evals/run_evals.py` with `--outbox`, tuning cases (12) and held-out cases (8), policy `query` lookup now weights rare words and ignores stopwords, loader keeps head and tail of bodies over 4000 chars.
- Repo: `.gitignore` extended; `README.md` has the approach note, test commands and the zip command; `samples/outbox.json` and `samples/logs/` are tracked sample outputs.
- Commits: `4074b51` (agent + Gate 1) and a second commit with everything after it.

### In progress
- Nothing.

### Next steps (in order)
1. **User:** create Gmail label `helpdesk` with 3 to 5 throwaway emails; I run `--gmail --no-drafts`, then `--gmail`; confirm drafts appear and Sent is empty.
2. Optional P2: `--watch` and `dashboard/streamlit_app.py` (needs `streamlit`: ask before adding the dependency).
3. Optional: `find_related_emails` (P1, not implemented), second-model fallback.
4. Freeze: refresh `samples/` from a final run, fresh-clone test, delete `docs/credentials`, zip with `git archive`.

### Blockers and open questions
- Gmail label still empty/missing; real fetch and drafts are **unverified**.
- Team size and whether the key is shared are still unconfirmed with organizers.
- `docs/credentials` (ignored, never read) is still on disk; delete or move it before any plain folder zip.

### Assumptions made
- Tool names the model sees are `LookupPolicy` and `Submit`.
- Fallback rows escalate (design 5.4), so an empty or HTML-only email is escalated for a human; the eval runner exempts fallback rows from the ESC-code check.
- Safety net forces escalation directly instead of re-asking the model once first (marked `shortcut:`); false positives are possible (for example "fire" in a non-hazard sense).
- `find_related_emails` not implemented; overdue complaints rely on what the email states.
- Replies are not code-checked for language match.

### Files touched
`.gitignore`, `README.md`, `agent.py`, `app/{graph,llm,loader,policy,prompts,safety,tools,validators}.py`, `evals/run_evals.py`, `evals/cases/*`, `evals/heldout/*`, `samples/*`, `tests/test_agent.py`, `tests/test_scaffold.py`, `HANDOFF.md`, `ARCHITECTURE.md`.

### How to run and verify (last real results)
- `pytest -q`: 26 passed.
- `python agent.py`: 20 rows, about 41 LLM calls, about 1 minute, no fallbacks. `python agent.py --only-new` straight after: 20 reused, 0 calls.
- `python evals/run_evals.py --outbox`: 0 problems over 20 rows.
- `python evals/run_evals.py` (tuning): 12 of 12 pass.
- `python evals/run_evals.py --heldout`: first run failed 3 of 8. H07 and H08 were harness mistakes (fallback rows escalate by design; their expectation and the ESC-code check were wrong). H06 (long email) exposed real issues (tail truncated, ESC-3 over-triggered, issue not looked up), fixed with head+tail truncation and two prompt lines, then passed 8 of 8. **H06 is therefore no longer a clean held-out case**; the other seven were not tuned on.
- Not run: Gmail path, `--watch`, dashboard.

### Known issues
- Run-to-run variation: LLM output is not identical across runs (for example confidence 0.9 vs 0.5, E010 priority). The A-case regression after the prompt change was caused by weak keyword lookup (fixed), so lookup quality drives results.
- Replies sometimes begin with "Yes" or similar mild commitments; spot-check before presenting.
- Testing-mode OAuth token expires after 7 days (delete `secrets/token.json` on `invalid_grant`). `secrets/` is inside OneDrive.
- `ARCHITECTURE.md` 6.1 "best-matching section" fallback is still not implemented (lookup with zero overlap returns the section list).

### Notes for the other person
- Treat as one workflow. No `superpowers:*` skills here. Never commit `.env`, `secrets/` or fetched Gmail files.

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
