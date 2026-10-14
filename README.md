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

## Approach

(To be completed in P0.3: fixed code vs agent decisions, the LangGraph loop, validators, safety, limitations. See `ARCHITECTURE.md`.)

## Status

Scaffold only: the loader, policy parser, writer and logger work; the LLM agent graph is not implemented yet, so every email currently receives the safe fallback row.
