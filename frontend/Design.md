# Design.md: Student Helpdesk Triage Console (frontend)

Brief for the frontend. Start with mock data (section 8) while the backend is already running (section 7).
Stack: **Vite + React** (TypeScript recommended). UI libraries, routing and styling approach are your choice.
Folder: everything lives in `frontend/`. Do not edit `backend/`, `app/` or `agent.py`; ask first if the API needs a change.

## 1. What this product is

A university helpdesk receives student emails. An AI agent reads each email, looks up the university policy, decides **category, priority and whether a human must handle it**, and writes a **reply draft**. Nothing is ever sent: replies are drafts for a human to review.

This UI is the **console** over that agent. It is demoed **live to judges**: someone types or pastes a new student email, and the audience watches the agent think step by step and produce a decision.

### Users
- **Helpdesk staff:** scan the queue, spot urgent and escalated emails, read and copy a reply draft.
- **Judges / reviewers:** need to *see how the agent reasoned* (the step timeline) and trust it.

### Product principles
1. **Urgency first.** Escalated and high-priority items must be impossible to miss.
2. **Explainable.** Every decision shows its reasoning (step timeline) and the policy codes it relied on.
3. **Honest about uncertainty.** Low confidence and "needs a human" (fallback) rows look different from confident ones.
4. **Calm and trustworthy**, not flashy. It is a work tool with sensitive content (harassment, wellbeing).

## 2. Screens

### 2.1 Dashboard (home)
- **Stat cards** from `GET /api/stats`: total processed, escalated, high priority, needs human (fallback), average confidence.
- **Breakdowns:** by category and by priority (small charts or bars; keep them readable, no decoration).
- **Queue table** from `GET /api/emails`: columns: priority, escalate badge, category, subject, student, received, confidence, status.
  - Default sort: escalated first, then priority high > medium > low, then newest.
  - Filters: priority, category, escalated only, status (pending / processing / done), text search over subject and student.
  - Row click opens the detail screen. Rows with `status: "processing"` show a spinner.
- **Run bar:** button "Process all" (`POST /api/process`), a checkbox "only new / unchanged skipped", and live progress `done / total` from the `run` event.

### 2.2 Email detail (`/emails/:id`)
Two columns on desktop, stacked on phone.
- **Left, the email:** subject, from name and address, received time, body as **plain text** (see 6).
  Show `load_warnings` (for example "body shortened") as a quiet notice.
- **Right, the decision:**
  - Header chips: category, priority, escalate (with `escalation_reason`), confidence.
  - **Policy refs** as chips (`FEE-2`, `ESC-1`); click opens a small popover with the clause text from `GET /api/policy`.
  - **Reply draft:** shown like an email draft, with a word counter ("92 / 150") and a **Copy** button. It is a draft only; there is no Send button anywhere in this product.
  - **Agent notes** (short text).
- **Step timeline** (the demo centerpiece): vertical timeline of `steps[]`. Each step shows who decided (`model` vs `rule`), the action, the reason, latency, and a result line. Visually separate model steps from rule steps (validators, safety net, fallback). A rejected validation is a normal, visible part of the story ("validator rejected: missing policy code, agent revised").

### 2.3 Submit an email
A form: from name, from email, subject, body (large textarea), checkbox "Process now" (default on). `POST /api/emails`, then jump to the new email's detail page and show the timeline filling in live.
Include 4 to 5 **example buttons** that prefill the form (a fee question, a hostel electrical hazard, a Roman Urdu question, a harassment report, a prompt-injection attempt) so the demo is one click. The example text is yours to write; keep it fictional.

### 2.4 Live feed (can be a panel on the dashboard)
A compact stream of the most recent agent steps across all emails, from the SSE `step` events: `E014 · step 2 · model · Submit · reason`. New lines animate in subtly. This is what the audience watches while an email is processing.

### 2.5 Policy viewer (optional, low effort)
Read-only list of sections and clauses from `GET /api/policy`. Reuse the clause popover component.

## 3. Visual language

- Tone: professional, calm, high legibility. Light and dark themes if time allows; light first.
- **Semantic colors** (the one place color carries meaning; always pair with text or an icon, never color alone):
  - priority: `high` = strong red/orange, `medium` = amber, `low` = neutral/green-grey.
  - `escalate: true` = prominent badge with an icon ("Escalated") plus the office from `escalation_reason`.
  - confidence: show as a small meter; below 0.5 use a muted "uncertain" style.
  - `confidence == 0.0` is a **fallback** row ("Needs a human, automatic processing failed"): distinct warning style.
  - step `decided_by`: `model` and `rule` clearly different (for example icon plus tint).
- Typography: one readable sans-serif, tabular numbers for counts and times. Monospace only for policy codes and ids.
- Density: the queue is a table, so keep rows compact but scannable; the detail screen is spacious.
- Motion: subtle only (new row, new timeline step). Respect `prefers-reduced-motion`.

## 4. States every screen needs

- **Loading** (skeletons), **empty** (no emails yet: point to "Submit an email"), **error** (API unreachable: show a clear message and a retry; the backend may not be running).
- **Processing** (an email with `status: "processing"` or a run in progress).
- **Long text:** bodies up to 20,000 characters; scroll inside the panel, do not break the layout.
- **Non-English:** emails and replies can be **Roman Urdu** (Urdu in Latin letters) or contain Urdu script; do not assume English or fixed widths.
- Accessibility: keyboard reachable table and filters, visible focus, labels on form fields, contrast AA, live regions for the progress and feed (polite), semantic landmarks. Phone width must work (single column, table becomes cards).

## 5. Data you will receive

### Row (`record`)
```json
{
  "email_id": "E005",
  "category": "hostel",
  "priority": "high",
  "escalate": true,
  "escalation_reason": "ESC-1: electrical hazard; Hostel Warden and Security",
  "policy_refs": ["HOSTEL-3"],
  "reply_draft": "Dear Danish Ali, ... Student Helpdesk",
  "confidence": 0.9,
  "agent_notes": "Electrical hazard with water dripping nearby. ..."
}
```
- `priority`: `low | medium | high`. `escalate`: boolean. `escalation_reason` is `""` when not escalated.
- `category` is an **open set**, currently: `fee, hostel, academic, technical, wellbeing, harassment, legal_media, security, other`. Unknown values must still render (generic chip).
- `confidence`: 0 to 1. `0.0` means fallback row.
- Real examples: `../samples/outbox.json`; real step logs: `../samples/logs/E001.jsonl`.

### Step (`steps[]` and SSE `step` event)
```json
{"ts": "2026-10-14T07:56:39.478858+00:00", "email_id": "E005", "step": 2, "decided_by": "model",
 "provider": "gemini", "action": "Submit", "reason": "The email reports an electrical hazard...",
 "args": {}, "result": "", "latency_ms": 2200}
```
- `decided_by`: `model | rule`. `action` examples: `LookupPolicy`, `lookup_result`, `Submit`, `validate`, `safety_net`, `fallback`, `no_tool_call`.
- `reason` is free text, may be long. For `validate` it is `accepted` or `rejected: CODE: message`.
- Steps arrive in order; show as they come. A run for one email normally has 2 to 5 steps.

## 6. Safety rules for the UI (important)

- **Email text is untrusted.** Render emails and replies as **plain text** (React's default escaping). Never use `dangerouslySetInnerHTML`, never auto-link or execute anything inside an email. Emails can contain scripts, phishing links and prompt-injection text; some sample emails do.
- No "Send" anywhere. Copy-to-clipboard is the only outward action.
- Sensitive categories (`harassment`, `wellbeing`): show calmly, no playful empty states or emoji.
- No secrets in the frontend. The only config is `VITE_API_URL` (default `http://localhost:8000`).

## 7. API (backend, already implemented)

Run it from the repo root: `uvicorn backend.main:app --port 8000` (the dev server is expected on `http://localhost:5173`; CORS is already allowed). Interactive docs: `http://localhost:8000/docs`.

| Method and path | Purpose | Response |
|---|---|---|
| `GET /api/health` | backend and LLM ready | `{status, model, llm_ready}` |
| `GET /api/emails` | the queue | array of `{id, from_name, from_email, subject, received_at, status, record}`; `status` is `pending \| processing \| done`; `record` is the row or `null` |
| `GET /api/emails/{id}` | one email | same fields plus `body`, `load_warnings[]`, `steps[]`; `404` if unknown |
| `POST /api/emails` | add an email | body `{from_name, from_email, subject, body, process=true}`; `201 {id, processing, run}`; `422` if subject and body are both empty |
| `POST /api/process` | run the agent | body `{only_new=false, ids=null}`; `202` with run state; `ids: null` means every email |
| `GET /api/run` | run progress | `{running, total, done, llm_calls, queued, pending_ids[]}` |
| `GET /api/stats` | dashboard numbers | `{total, emails_in_inbox, escalated, needs_human_fallback, avg_confidence, by_category{}, by_priority{}}` |
| `GET /api/policy` | policy clauses | `[{section, clauses: [{code, text}]}]` |
| `GET /api/events` | live stream (SSE) | events `step` (a step object) and `run` (a run state object); see below |

### Live updates (SSE)
```ts
const es = new EventSource(`${API}/api/events`);
es.addEventListener("step", (e) => addStep(JSON.parse(e.data)));
es.addEventListener("run", (e) => setRun(JSON.parse(e.data)));
```
- `step` events arrive as the agent works; when a step has `action: "validate"` and `reason: "accepted"` (or `action: "fallback"`), the final row is saved, so refetch `GET /api/emails/{id}`.
- `EventSource` reconnects by itself. Fall back to polling `GET /api/run` every 2 s if the stream fails.
- A new email takes roughly 3 to 10 seconds; a full run of 20 emails takes about a minute.
- Not yet available (planned): Gmail fetch trigger. Do not build UI for it yet.

## 8. Working before the backend is ready, or without the model

- Mock with `../samples/outbox.json` (20 rows) and `../samples/logs/*.jsonl` (step timelines). The email bodies are in `../data/inbox/E*.json` (the fictional sample inbox).
- Build a tiny `api.ts` client with a `VITE_USE_MOCK=1` switch so the UI runs with no backend.

## 9. Deliverables and definition of done

- `frontend/` runs with `npm install && npm run dev`; a short `frontend/README.md` says how (and the `VITE_API_URL` variable).
- Screens 2.1 to 2.4 work against the real backend; 2.5 optional.
- All states in section 4 handled; works at phone width; keyboard usable.
- Demo script works: open the dashboard, click an example, submit, watch the timeline fill live, open the finished decision, copy the reply.
- No new tracked secrets; `node_modules/` and build output are gitignored (the repo `.gitignore` already covers `frontend/node_modules`, `frontend/dist`).
