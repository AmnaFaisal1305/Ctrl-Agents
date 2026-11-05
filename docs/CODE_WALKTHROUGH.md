# Code Walkthrough — What Each File Does and the Call Order

This explains the repo file by file, the order files are called in, and a line-by-line trace of the main path. It's grounded in the actual code (line numbers are real). For *how the ML model trains*, see `MODEL_TRAINING_EXPLAINED.md`; this file is about the **agent + backend** code.

There are **three independent entry points**:
1. `python agent.py` — the CLI triage agent (the core deliverable).
2. `uvicorn backend.main:app` — the web API that drives the React UI.
3. `analysis/eda.ipynb` / `generate_data.py` — the standalone CCA classification study (separate; see §6).

---

## 1. The call map (who calls whom)

```
python agent.py
  └─ agent.py: main()                         [agent.py:81]
       ├─ app/config.py   load_settings()     read .env, paths, model name
       ├─ app/gmail.py    gmail_fetch()        only with --gmail
       ├─ app/loader.py   load_inbox()         read data/inbox/*.json -> [EmailIn]
       ├─ app/policy.py   Policy.parse()       parse data/policy.md -> clauses
       ├─ app/llm.py      make_llm()           build Gemini client + bind tools
       ├─ app/reflect.py  make_critic()        optional shadow reviewer
       └─ for each email (thread pool):
            agent.py: process()                [agent.py:22]
              └─ app/graph.py: run_email()     [graph.py:128]
                   ├─ app/safety.py   preflags()        advisory hints
                   ├─ app/prompts.py  build_system_prompt(), build_email_block()
                   ├─ build_graph().invoke()   the LangGraph loop:
                   │    ├─ agent  node → app/llm model.invoke()  (one tool call)
                   │    ├─ tools  node → app/tools.lookup_policy() → app/policy.lookup()
                   │    └─ submit node → app/validators.validate()
                   │         (loops agent↔tools↔submit until valid / budget hit → fail node → app/fallback)
                   ├─ app/safety.py   post_check()      force escalation if life-safety missed
                   └─ app/reflect.py  critique()        shadow review (logged only)
       ├─ app/writer.py   write_outbox()       atomic outbox.json
       └─ app/gmail.py    save_drafts()        only with --gmail (drafts, never send)

Every node calls app/logger.py: log_step() → writes logs/<id>.jsonl + prints a console line.
```

The backend reuses the *same* `agent.process` and `app/*` code (so API and CLI behave identically) — see §5.

---

## 2. Line-by-line: the CLI run (`agent.py`)

### `main()` — `agent.py:81`
- **82** force UTF-8 console (Roman Urdu/emoji safe).
- **83, 92** `load_settings()` then override with CLI args (`--inbox/--out/--workers`).
- **94** if `--gmail`: `gmail_fetch()` pulls the Gmail label into the inbox and returns the fetched ids; otherwise `(None, set())`.
- **95** `load_inbox()` → list of `EmailIn` (one per file).
- **96** `Policy.parse()` → the policy object the agent will look things up in.
- **97–98** `--only-new`: `reusable_rows()` keeps last run's rows for unchanged emails (hash compare); `todo` = the rest.
- **100–103** `make_llm()` builds the model; if it throws (e.g. no API key) `model=None` and every email still gets a fallback row.
- **104–109** build the optional shadow `critic` (off if `REFLECT=0`).
- **110–111** `ThreadPoolExecutor` runs `process(email, …)` concurrently (default 2 workers).
- **112** combine fresh results + reused rows.
- **114** write `seen.json` (content hashes, for next `--only-new`).
- **115** `write_outbox()` — atomic, sorted.
- **116–117** with `--gmail` (and not `--no-drafts`): `save_drafts()`.
- **118** print the summary with the total LLM-call count.

### `process()` — `agent.py:22`
The per-email safety wrapper. **24–30**: if no model → fallback row; else `run_email(...)`; any exception → fallback row. **This is why the agent "never crashes" (R9).**

### `email_hash()` / `reusable_rows()` — `agent.py:33, 37`
SHA-256 of sender+subject+body; `--only-new` reuses a prior row only if the hash matches (content unchanged).

### `save_drafts()` — `agent.py:48`
Mirrors each `reply_draft` into a Gmail **draft** (never sent), skipping ones already drafted (state in `logs/gmail_drafts.json`, or passed in by the backend). One failed draft doesn't stop the run (**65–66**).

---

## 3. Line-by-line: the agent loop (`app/graph.py`)

### `run_email()` — `graph.py:128` (the heart)
- **130** delete the old `logs/<id>.jsonl` so each run is one clean timeline.
- **131–134** empty subject *and* body → skip the LLM, write a fallback ("no usable text").
- **135** `preflags(email)` → advisory hint strings (hazard / self-harm / injection).
- **136–137** `context_meta()` logs the step-0 `context` row (prompt sizes, for observability).
- **138–142** build the initial `GraphState`: the system prompt + the email block as the first two messages; counters zeroed.
- **144** `build_graph(...).invoke(state, recursion_limit=25)` runs the loop.
- **145–147** `post_check()` — the life-safety net; if it forced escalation, log `safety_net`.
- **148** if a critic exists and the row isn't a fallback: `_reflect()` (shadow review).
- **150–153** any exception anywhere → fallback row (fail soft).

### `build_graph()` — `graph.py:42` defines four nodes:

**`agent` node (46)** — calls the model (**48** `model.invoke`), counts the call, logs it. If the model returned no tool call (**51**) it nudges "Call exactly one tool." Otherwise it logs the chosen tool + the model's `reason` (**56**).

**`tools` node (59)** — runs `lookup_policy()` with the model's args (**62**), extracts the returned codes (**63**), logs `lookup_result`, and appends the clause text back into the conversation plus records which codes were looked up (**66**). Extra parallel tool calls are refused (**35–39**, "one tool per turn").

**`submit` node (68)** — builds an `OutboxRecord` from the model's args (**72**), runs `validate()` (**73**). Hard issues → log "rejected", send the issues back for a revision (**82–84**). No hard issues → accept; if a soft issue is unresolved, cap confidence at 0.6 (**78–79**); log "accepted" (**80–81**).

**`fail` node (86)** — writes a `fallback_record` when the step budget or 2-revision limit is hit.

**Routing (91–108):**
- `after_agent` → `submit` if the tool was `Submit`, else `tools`; if no tool and budget left, back to `agent`, else `fail`.
- `after_act` → `END` if a record exists; else `agent` (revise) unless the budget/revision cap is hit → `fail`.
- Edges wired at **105–109**; `MAX_STEPS=6` (model turns) and `MAX_REVISIONS=2`.

### `_reflect()` — `graph.py:113`
Calls `critique()`; logs the verdict as a `reflect` row; **never changes the record**. Any failure logs `reflect_failed` and is ignored.

---

## 4. The app/ modules (reference)

| File | What it does | Key functions | Called by |
|---|---|---|---|
| `app/config.py` | Paths, env vars, constants (`MAX_STEPS=6`, `WORD_LIMIT=150`, `BODY_LIMIT=4000`) | `load_settings()`, `Settings` | everyone |
| `app/models.py` | Pydantic schemas: `EmailIn`, `OutboxRecord` (the 9 output fields), `Issue`, `GraphState` | — | everywhere |
| `app/loader.py` | Read email JSON tolerantly; strip HTML, normalise whitespace, head+tail-truncate long bodies; never raises | `load_inbox()`, `load_email()`, `email_from_text()`, `clean_text()` | `agent.main`, backend |
| `app/policy.py` | Parse `policy.md` into `Clause`s; keyword lookup that weights rare words higher | `Policy.parse()`, `lookup()`, `sections()` | graph, prompts, validators |
| `app/prompts.py` | Build the system prompt (rules + always-on ESC/Reply policy) and the `<email>` block | `build_system_prompt()`, `build_email_block()`, `context_meta()` | `graph.run_email` |
| `app/llm.py` | Gemini client (temp 0, timeout 30s, 3 retries) bound to the two tools | `make_llm()` | `agent.main`, backend |
| `app/tools.py` | Tool **schemas** the model sees: `LookupPolicy`, `Submit`; and `lookup_policy()` runner | `lookup_policy()`, `TOOLS` | graph, llm |
| `app/validators.py` | Hard/soft checks on each submit: word limit, sign-off, codes exist + were looked up, code-in-reply, escalation consistency, no invented contacts, no copy/markdown | `validate()` | `graph.submit` |
| `app/safety.py` | Advisory pre-flags; life-safety net that **forces** escalation for ESC-1/ESC-3 (English + Roman Urdu lexicons) | `preflags()`, `post_check()`, `safety_hits()` | `graph.run_email` |
| `app/fallback.py` | The safe holding row: `other`/`high`/`escalate`, confidence 0, promises nothing | `fallback_record()` | agent, graph |
| `app/writer.py` | Atomic write of `outbox.json` (temp file → rename), sorted by id | `write_outbox()` | `agent.main` |
| `app/logger.py` | One JSONL line + one console line per step; attaches optional `meta` (tokens, sizes) | `log_step()` | every node |
| `app/reflect.py` | Shadow critic: a 2nd structured model call reviews the final row; logged, never applied | `make_critic()`, `critique()`, `reflect_enabled()` | agent, graph, backend |
| `app/gmail.py` | OAuth (readonly + compose), fetch label into inbox, create threaded drafts. **No send path exists** | `get_service()`, `fetch_inbox()`, `create_draft()` | `agent` (with `--gmail`), backend |

**One email's journey, in words:** a file is read into an `EmailIn` (`loader`), pre-scanned for danger words (`safety`), wrapped in a prompt with the rules (`prompts`), then the model loops — look up policy (`tools`→`policy`), draft a reply, submit it, get it checked (`validators`), fix and resubmit if needed — until a valid record passes; a life-safety net (`safety`) can override it; a critic (`reflect`) reviews it for the log; the row is written (`writer`) and every step is logged (`logger`).

---

## 5. The backend (`backend/`)

Same agent, wrapped in HTTP + a database so the React UI can drive it.

| File | What it does | Key pieces |
|---|---|---|
| `backend/main.py` | FastAPI routes + CORS + auth dependency + the SSE stream | `/api/emails`, `/api/process`, `/api/gmail/fetch`, `/api/events`, …; `lifespan()` seeds the DB; `require_auth()` |
| `backend/service.py` | All the logic (no HTTP here). Wraps `agent.process`, queues runs on a thread pool, saves rows/steps to SQLite, aggregates metrics | `Service` class, `start_run()`, `_process()`, `LogTail` (powers SSE) |
| `backend/store.py` | SQLite store (emails, records, steps, meta); seeded from samples when empty | `Store`, `read_jsonl()` |
| `backend/auth.py` | Optional demo login: password → signed token; admin key for Gmail | `auth_required()`, `password_ok()`, `make_token()`, `admin_ok()` |
| `backend/metrics.py` | Pure aggregation of step logs into the Observability numbers | `aggregate()` |

**Backend request flow (e.g. "process all"):**
```
POST /api/process                       [main.py:138]
  └─ Service.start_run()                 [service.py:174]  checks ids + daily LLM budget
       └─ _queue → _job → _run → _process        [service.py:231–250]
            └─ agent.process(e, model, policy, logs, critic)   ← SAME function the CLI uses
                 └─ app/graph.run_email(...)                    ← identical loop
       results saved to SQLite (store.put_record / set_steps)
GET /api/events (SSE)                    [main.py:198]
  └─ LogTail.poll() tails logs/*.jsonl and streams each new step to the browser live
```
The key point for the viva: **the API does not reimplement the agent** — `service.py:242` calls the very same `agent.process`, so the web demo and `python agent.py` produce the same decisions.

---

## 6. The analysis layer (`analysis/`) — separate

Not called by the agent or backend. Run on its own.

| File | What it does |
|---|---|
| `analysis/generate_data.py` | Builds the 400-row synthetic CSV. `TEMPLATES` (one block per category, each with `<<VAR>>` slots + priority/escalate rates) → `generate_dataset()` fills templates with random names/rolls/reasons (`render`, `_fill`), picks priority by weights, shuffles, writes `data/synthetic_emails.csv`. `random.seed(42)` makes it reproducible. |
| `analysis/eda.ipynb` | Loads 20 real + 400 synthetic → 420 rows, EDA, preprocessing, TF-IDF, trains LogReg/NB/SVM, evaluates (report, confusion matrix, 5-fold CV), tunes + ensembles, compares vs the LLM agent. Full step-by-step in `MODEL_TRAINING_EXPLAINED.md`. |

`evals/run_evals.py` is a third, agent-side checker (property checks on `outbox.json`, plus adversarial/held-out cases) — related to the agent, not the ML study.

---

## 7. Fast facts for questions

- **"Which file decides the category?"** None — the **LLM** decides inside the `agent` node (`graph.py:48`). Fixed code only *constrains* it (validators, safety net).
- **"Where's the 150-word limit enforced?"** `app/validators.py:20`.
- **"Where does it guarantee every email gets a row?"** Three fallbacks: `agent.process` (26–30), `graph.run_email` (131–134, 150–153), and the graph `fail` node (86–89).
- **"Where is nothing-ever-sent guaranteed?"** There is no send call anywhere; `app/gmail.py` only fetches and creates drafts; a test greps the code for send calls.
- **"Where are steps logged?"** `app/logger.py:log_step` — every node calls it; the SSE stream (`service.py` `LogTail`) tails those files.
- **"CLI vs backend — same agent?"** Yes: `backend/service.py:242` calls `agent.process`, the same function `agent.py:111` uses.
