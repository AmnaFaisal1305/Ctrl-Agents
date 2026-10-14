# Student Helpdesk Triage Agent

Reads student emails from `data/inbox/*.json`, looks up `data/policy.md`, decides category, priority and escalation, drafts a policy-grounded reply and writes `outbox.json` with a step log in `logs/`. Nothing is ever sent.

## Setup

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # then put your key in GOOGLE_API_KEY
```

## Run

```
python agent.py             # every *.json in data/inbox -> outbox.json
```

Drop a new `.json` email into `data/inbox/` and run again; no code change is needed.

## Gmail (optional, for the Gmail-based evaluation)

Read-only plus drafts: scopes `gmail.readonly` and `gmail.compose`. Nothing is ever sent.

1. Google Cloud Console: create a project, enable the Gmail API, set up the OAuth consent screen (External, Testing, add your Gmail as a test user, add both scopes), create an OAuth client of type **Desktop app**, download it as `secrets/credentials.json`.
2. In Gmail create a label `helpdesk` (or change `GMAIL_QUERY` in `.env`) and put the emails to triage under it.
3. `python agent.py --gmail` (first run opens a browser to authorize; use `--no-drafts` to skip drafts). If you get `invalid_grant`, delete `secrets/token.json` and run again; Testing-mode tokens expire after 7 days.

`secrets/`, `.env` and fetched Gmail files are gitignored and must stay out of the submission zip.

## Approach

**Fixed code vs agent.** Fixed code finds and tolerates files, cleans text, parses the policy, serves lookups, validates, retries and falls back. The model (Gemini, temperature 0) decides category, priority, escalation, which policy to look up, and the reply. There is no logic keyed to email ids, subjects or sample text.

**Loop (LangGraph, `app/graph.py`).** `agent` (model must call one tool per turn, with a reason) -> `tools` (`LookupPolicy`) -> `agent` ... -> `submit` (validators). A rejected submit sends the issues back for revision (max 2, max 6 model turns), then a safe fallback row is written. Every step is logged to `logs/<id>.jsonl` and the console.

**Validators (`app/validators.py`).** Schema, under 150 words, sign-off `Student Helpdesk`, policy codes exist and were actually looked up, a code appears in the reply, escalation reason names an ESC rule, no invented phone/email/URL, no markdown, no copied email text.

**Safety.** Email text is untrusted data in `<email>` tags; injection and hazard words only add advisory hints. A life-safety net (hazards, medical or hopelessness, English and Roman Urdu) forces `escalate: true` if the model missed it. Nothing is ever sent; Gmail is read plus drafts only.

**Limitations.** Keyword policy lookup (no embeddings); replies are not language-checked by code; the safety net can over-escalate on a trigger word; bodies over 4,000 characters keep head and tail only; `find_related_emails` (earlier emails from the same sender) is not implemented, so overdue complaints rely on what the email itself says.

## API backend (for the React frontend)

```
uvicorn backend.main:app --port 8000      # run from the repo root; docs at http://localhost:8000/docs
```

`GET /api/emails`, `GET /api/emails/{id}` (with step timeline), `POST /api/emails` (add and process), `DELETE /api/emails/{id}` (only emails added through the API), `POST /api/emails/{id}/reprocess`, `POST /api/process`, `POST /api/gmail/fetch` (read-only fetch, optional drafts), `GET /api/run`, `GET /api/outbox`, `GET /api/stats`, `GET /api/policy`, and a live stream at `GET /api/events` (SSE). There is no send endpoint. The frontend brief and full API table are in `frontend/Design.md`.

## Tests and evals

```
pytest                                   # unit tests, LLM mocked
python evals/run_evals.py --outbox       # property checks on outbox.json (no LLM)
python evals/run_evals.py                # 12 adversarial tuning cases (real LLM)
python evals/run_evals.py --heldout      # 8 held-out cases: run at the gate, not while tuning
python agent.py --only-new               # reuse rows for unchanged emails
```

## Status

All 20 sample emails produce valid rows (about 40 LLM calls, about a minute). Sample output is in `samples/`. See `HANDOFF.md` for what remains (Gmail verification, optional dashboard).

## Building the submission zip

Zip only tracked files so secrets, `.env`, `.venv/`, `logs/` and caches are left out automatically:

```
git archive -o AgentSprint_<TeamName>.zip HEAD
```
