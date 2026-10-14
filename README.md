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

(To be completed in P0.3: fixed code vs agent decisions, the LangGraph loop, validators, safety, limitations. See `ARCHITECTURE.md`.)

## Status

Scaffold plus Gmail plumbing: the loader, policy parser, writer, logger and Gmail fetch/draft code work; the LLM agent graph is not implemented yet, so every email currently receives the safe fallback row.
