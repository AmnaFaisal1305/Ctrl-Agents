# HANDOFF.md

Updated at the end of every session. Newest session at the top. Keep it short and factual.

## Session 2 (P0.2: LLM graph, Gate 1)

**Date:** 2026-10-14

### Status
- **Gate 1 passed** (E001, E002 end to end with real `gemini-2.5-flash`). Next is **P0.3** (all 20, prompt tuning). Gmail verification still pending (agreed to do after Gate 1).

### Done
- `app/tools.py` (`LookupPolicy`, `Submit` pydantic tool schemas, `lookup_policy`), `app/validators.py` (section 7 hard + soft checks), `app/prompts.py`, `app/llm.py` (`bind_tools(..., tool_choice="any")`, timeout 30, `max_retries=3`), `app/graph.py` (agent / tools / submit / fail nodes, `MAX_STEPS=6`, 2 revisions, then fallback).
- `agent.py` now calls `run_email(email, model, policy, logs) -> (record, llm_calls)` and prints the real LLM call count. A missing key or LLM error gives fallback rows, not a crash.
- `app/policy.py`: `Policy.raw_sections` (verbatim bullets per section) so the system prompt carries ESC and Reply rules verbatim.
- `tests/test_agent.py`: 7 tests with a scripted fake model (accept, reject-then-fix, 2 bad submits, step budget, empty email, LLM exception, validator contacts/word limit).
- Own mistake, fixed: the model reports tool names `Submit` and `LookupPolicy` (class names), but routing checked `"submit"`, so the first real run burned 6 calls and fell back. Tests used the wrong names too, so they missed it. Now routing, prompt and tests use the real names.

### In progress
- Nothing.

### Next steps (in order)
1. ~~Quota decision~~ **Resolved:** a paid key is now in `.env`; 7 rapid calls succeeded in 7 s (the earlier free-tier key was capped at 5 per minute). Quota discipline still applies: single emails while tuning, all 20 only at gates.
2. P0.3: run all 20 once, read every reply, tune prompts, test fallback paths, add the `lookup_policy` best-section fallback, draft `README.md`. Gate 2.
3. Gmail: create `helpdesk` label with 3 to 5 test emails, run `--gmail --no-drafts`, then `--gmail`; confirm drafts exist and Sent is empty.
4. P1 per `ARCHITECTURE.md` section 9.

### Blockers and open questions
- ~~Free-tier 429~~ resolved by the paid key (the old key was limited to 5 requests per minute).
- Earlier blockers still open: empty Gmail label, team size, shared key, stray `docs/credentials`.

### Assumptions made
- Tool names exposed to the model are the class names `LookupPolicy` and `Submit`.
- `escalation_reason` is only checked to be non-empty when `escalate` is true (marked `shortcut:`); language-match soft check not implemented.
- `find_related_emails` stays a P1 stub; `safety.py` untouched.
- `run_email` signature changed from the stub (`run_email(email)`) to include model, policy, logs and a call count; no one else used it.

### Repo organization (end of session 2)
- `.gitignore` now also covers `.env.*` (except `.env.example`), `.agents/`, `.claude/`, `skills-lock.json`, editor/cache files and `submission*.zip`. Build the zip with `git archive -o AgentSprint_<TeamName>.zip HEAD` (tracked files only; README documents it).
- `docs/credentials` (410 bytes, ignored, never read) is still on disk and would be included by a plain folder zip; delete or move it outside the repo.
- `logs/` and `outbox.json` are gitignored. Checklist section 13 wants a sample of each in the submission: at the freeze, copy them to a tracked `samples/` folder.

### Files touched
`.gitignore`, `README.md`, `app/tools.py`, `app/validators.py`, `app/prompts.py`, `app/llm.py`, `app/graph.py`, `app/policy.py`, `agent.py`, `tests/test_agent.py`, `HANDOFF.md`, `ARCHITECTURE.md`.

### How to run and verify
- `.venv\Scripts\python -m pytest -q`: 21 passed.
- Real run, one email at a time, in a temp inbox: `python agent.py --inbox <dir> --out <file> --workers 1`.
  - E001: `fee`, medium, no escalation, refs `FEE-2`, confidence 0.9, 2 LLM calls, reply tells Hamza to apply to the Accounts Office with proof. Validated and accepted.
  - E002: `fee`, medium, no escalation, refs `FEE-3`, confidence 0.9, 2 LLM calls, reply says apply before the due date, up to 3 installments, 5 working days.
  - `logs/E001.jsonl` and `logs/E002.jsonl` show lookup, result, submit and validate with reasons.
- Not run: all 20 emails, the Gmail path, anything on E003 to E020.

### Known issues
- Replies not yet checked against all 20 samples; E002 reply opens with "Yes, it is possible", which should be reviewed for over-promising.
- Gmail fetch and drafts still unverified. Earlier known issues from Session 1 remain.

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
