# Helpdesk Triage Console (frontend)

React + Vite + TypeScript console over the Student Helpdesk Triage Agent. The UI reads the agent's decisions and streams the step timeline live; **nothing
is ever sent** — the only outward action is Copy-to-clipboard.

## Run

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### Against the live backend (default)

Start the backend from the repo root in another terminal:

```bash
uvicorn backend.main:app --port 8000
```

The UI talks to `http://localhost:8000`. CORS for `localhost:5173` is already allowed.

### Without a backend (mock mode)

```bash
cp .env.example .env     # then set VITE_USE_MOCK=1
npm run dev
```

Mock mode serves the bundled sample inbox (`../samples/outbox.json`, `../samples/logs/*.jsonl`,
`../data/inbox/E*.json`) and replays a canned step stream, so the whole UI — including the live
timeline demo — works with no backend or model.

## Config

| Env var | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |
| `VITE_USE_MOCK` | `0` | `1` = use bundled sample data, no backend |

No secrets live in the frontend.
