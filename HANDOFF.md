# HANDOFF.md

Session state. **Section A is the single up-to-date picture; read it first.** Section B is the short history, newest first. Update both at the end of every session.

Last updated: 2026-10-14, end of session 2. Everything below is committed (latest commit `2ee6d18`) except this file.

---

# A. Current state

## A1. Where we are
| Area | State | Evidence (last real run) |
|---|---|---|
| Agent (`app/`, `agent.py`) | **Done.** P0 and P1 gates passed. | 20 samples: 20 valid rows, 0 fallbacks, about 41 LLM calls, about 1 minute. `evals --outbox`: 0 problems. Tuning cases 12 of 12; held-out 8 of 8 (after fixes, see C). |
| Backend (`backend/`) | **Done.** FastAPI, SSE, in-process agent. | Live server run with real Gemini: add, process, reprocess, delete, outbox, stats, SSE, error codes all OK. |
| Gmail | **Code done, unverified with real mail.** Read-only fetch ran against the real token and found 0 messages. | Label `helpdesk` is empty. Drafts never created for real. |
| Frontend (`frontend/`) | **Not started** (teammate). Brief is in `frontend/Design.md`. | Folder holds `Design.md` and `.gitkeep`. |
| Tests | `pytest`: **42 passed** (LLM and Gmail mocked). | |
| Submission | **Not prepared** (freeze checklist below). | |

Hard rules status: one command `python agent.py` works; 9 output fields only; nothing sent (a test greps for send calls, none in `app/`, `agent.py`, `backend/`); email text treated as data; secrets and `.env` untracked.

## A2. Pending items (in order)
1. **Gmail verification (needs you).** Create Gmail label `helpdesk` with 3 to 5 throwaway emails. Then: `python agent.py --gmail --no-drafts` (messages land in `data/inbox/`, rows in `outbox.json`), then `python agent.py --gmail` (drafts appear in Gmail, **Sent is empty**), then `POST /api/gmail/fetch` with `create_drafts` true and false. Check the reply drafts thread correctly and are not duplicated on re-run.
2. **Frontend (teammate).** Build from `frontend/Design.md` against `uvicorn backend.main:app --port 8000`. Deliverables: runs with `npm install && npm run dev`, a short `frontend/README.md`, screens 2.1 to 2.4 working, all states handled, demo script works. Then do one integration pass together (dashboard, submit, live timeline, copy reply).
3. **Docs drift to fix (needs your decision, see A3-1).** `ARCHITECTURE.md` sections 9 (P2/P3), 12 (Dashboard decision) and the modules table still mention Streamlit first, `web/` and `--export-web`; `CLAUDE.md` Commands and tables still list `streamlit run dashboard/streamlit_app.py`; empty `dashboard/` folder is still tracked.
4. **Freeze and submission** (`ARCHITECTURE.md` section 13):
   - [ ] Final full run, then refresh `samples/outbox.json` and `samples/logs/` from it (they currently come from the run before the backend work; same agent code).
   - [ ] Remove any `data/inbox/web-*.json` test files and matching `outbox.json` rows so the delivered inbox is exactly the intended emails.
   - [ ] Delete `docs/credentials` (ignored by git, never read, would be included by a plain folder zip).
   - [ ] Fresh-clone test in an empty folder using only README steps (venv, `pip install -r requirements.txt`, `.env`, `python agent.py`).
   - [ ] Re-authorize Gmail shortly before the demo (Testing-mode token lasts 7 days).
   - [ ] `git archive -o AgentSprint_<TeamName>.zip HEAD`; confirm no `.env`, `secrets/`, `.cache/`, `__pycache__/`, `node_modules/`.
   - [ ] Presentation notes: live run, fixed-vs-agent table, one decision timeline, an escalation case, an injection case, drop a new email and re-run (`--only-new` or the UI), one honest failure (H06 or the markdown/Roman Urdu fixes) and why it happened.
   - [ ] Email the zip before the deadline named in the task statement (the checklist says 3 PM; confirm); edit nothing afterwards.
5. **Optional, only if time and still wanted:** see A4.

## A3. Open questions (need an answer from you or the organizers)
1. **Streamlit vs React:** the React frontend replaces the planned Streamlit dashboard. Drop `dashboard/` and Streamlit from the docs, or keep Streamlit as a fallback? Recommended: drop it and update the docs (item A2-3).
2. **Team size:** the statement says 3 to 4 people; you are 2. Confirm with the organizers that this is approved.
3. **Gemini key sharing:** the paid key is now in `.env` (7 rapid calls succeeded, no 429). Confirm whether the organizers expect their own key at judging, and whether it will be shared (quota and the 5 per minute free-tier limit we hit earlier).
4. **Gmail account:** a personal Gmail is used (mitigations: narrow `label:helpdesk` query, readonly plus compose scopes only). A dedicated test account is safer; decide before the demo.
5. **Backend access:** the API has no authentication and CORS allows only `localhost:5173`. Is "local demo only, bound to localhost" acceptable, or do you want a simple API key?
6. **Frontend language:** TypeScript is recommended in `Design.md`; teammate to confirm.

## A4. Optional and deferred work (not started, none required for the gates)
| Item | Why deferred | Where |
|---|---|---|
| `--watch` (poll `data/inbox/` every 2 s) | UI "Process" and `--only-new` already cover the live demo | `ARCHITECTURE.md` P2 |
| `find_related_emails` tool | Overdue complaints (E004, E019, E020) already pass from what the email states | `app/tools.py` stub raises `NotImplementedError("P1")` |
| Second model or provider fallback | Not needed so far; SDK retries cover 429 | `ARCHITECTURE.md` section 8 |
| Policy `query` fallback to the best-matching section | Rare-word weighting fixed the observed miss; zero-overlap still returns a "try these sections" message | `app/policy.py` |
| Language-match soft validator | Prompt handles Roman Urdu (E016 verified); no code check | `app/validators.py` |
| Safety net: re-ask the model once before forcing | Forces directly (marked `shortcut:`); false positives possible | `app/safety.py` |
| `escalation_reason` must name an office (code only checks for an ESC code) | Prompt asks for it; all 20 rows comply | `app/validators.py` |
| HTTP-level tests with a client | Would add `httpx`; route functions are tested directly | `tests/test_backend.py` |
| Dev-only LLM response cache | Not needed at paid-key speed | `ARCHITECTURE.md` section 8 |
| Move `secrets/` out of OneDrive (`SECRETS_DIR`) | It syncs to the cloud | `.env.example` |
| `ponytail`-style `shortcut:` ledger | Shortcuts are marked in code with `shortcut:` comments | `app/policy.py`, `app/safety.py` |

## A5. Known issues and risks
- **Run-to-run variation:** LLM output is not identical across runs (confidence 0.9 vs 0.5, E010 priority and escalation changed after tuning). Re-run the 20 and read the replies once more before presenting.
- **Mild over-commitment:** some replies start with "Yes, it is possible..." (E002); policy-faithful but worth a last read.
- **Safety net false positives:** trigger words such as "fire" or "fainted" force an escalation even in a harmless context.
- **Held-out set is partly used:** H06 was fixed after it failed, so only H01 to H05, H07 and H08 are clean held-out evidence.
- **OAuth token expiry:** Testing-mode token lasts 7 days; on `invalid_grant` delete `secrets/token.json` and re-run `--gmail`.
- **Extra inbox files:** `POST /api/emails` writes `data/inbox/web-*.json`; a later `python agent.py` will process them too (they are gitignored, so not in the zip).
- **Line endings:** git prints LF to CRLF warnings on this Windows machine; harmless.
- **Live demo speed:** about 3 to 10 seconds per email, about 1 minute for 20; a 429 would show a retry line in the log (say so out loud, do not hide it).

## A6. How to run and verify
```
.venv\Scripts\activate
pytest -q                                   # 42 passed
python agent.py                             # all emails -> outbox.json, prints LLM call count
python agent.py --only-new                  # reuse rows for unchanged emails (0 calls)
python evals/run_evals.py --outbox          # property checks on outbox.json, no LLM
python evals/run_evals.py                   # 12 tuning cases (real LLM, about 25 calls)
python evals/run_evals.py --heldout         # 8 held-out cases; run once at the gate, not while tuning
python agent.py --gmail --no-drafts         # Gmail fetch (needs label emails) then process
uvicorn backend.main:app --port 8000        # API for the frontend; docs at /docs
```
Quota discipline: single emails while tuning; the full sets only at gates.

## A7. Key files and design decisions
- Loop: `app/graph.py` (LangGraph: agent, tools, submit, fail). Model tools are named `LookupPolicy` and `Submit`. 6 model turns max, 2 revisions, then fallback row (escalates, confidence 0.0).
- Prompt: `app/prompts.py` (ESC and Reply rules verbatim, email in `<email>` tags, advisory hints). Validators: `app/validators.py`. Safety: `app/safety.py`.
- Backend: `backend/main.py` (routes), `backend/service.py` (logic, one run at a time, `LogTail` for SSE). API table: `frontend/Design.md` section 7.
- Frontend brief: `frontend/Design.md`. Design source of truth: `ARCHITECTURE.md`. Rules: `CLAUDE.md` (no `superpowers:*` skills here).
- Untracked on purpose: `.env`, `secrets/`, `logs/`, `outbox.json`, fetched Gmail and `web-*` emails, `.agents/`, `.claude/`, `skills-lock.json`.

---

# B. Session history (newest first)

## Session 2 (2026-10-14): agent finalized, backend built
- P0.2: `tools`, `validators`, `prompts`, `llm`, `graph`, `agent.py` wired. First real run fell back because routing checked `"submit"` while the model's tool name is `Submit` (own mistake, fixed; tests used the wrong names too).
- Free-tier key was limited to 5 requests per minute; you then added a paid key.
- P0.3: all 20 replies read by hand; fixes for escalation without an ESC rule (E010), Roman Urdu (E016), markdown (E019), over-promising (E004, E005, E012).
- P1: safety net and pre-flags, `--only-new`, evals (12 tuning + 8 held-out), rare-word policy lookup, head+tail body truncation. Held-out first failed 3 of 8: H07 and H08 were harness mistakes (fallback rows escalate by design); H06 exposed real weaknesses, fixed.
- Repo organization: `.gitignore` extended, README approach note and zip command, `samples/`.
- Backend: FastAPI app, SSE live steps, reprocess, delete (`web-*` only), `/api/outbox`, `/api/gmail/fetch` (drafts only on request, never send), run `error` field, outbox write lock; `frontend/Design.md` written; `fastapi` and `uvicorn` pinned.
- Commits: `4074b51`, `d052fe4`, `6a5e400`, `2ee6d18`.

## Session 1 (2026-10-14): docs, scaffold, Gmail OAuth
- `ARCHITECTURE.md` moved to LangGraph, `gemini-2.5-flash`, `GOOGLE_API_KEY`, Gmail section 5.5, single owner; `docs/Mission.md` deleted; `CLAUDE.md` tables fixed.
- Scaffold: `models`, `config`, `loader`, `policy`, `fallback`, `writer`, `logger`, `gmail`, stub agent. Gmail OAuth works; `--gmail` fetch and draft code written with a send-guard test.
- Commits: `55f1556`, `0ddf3ec`.
