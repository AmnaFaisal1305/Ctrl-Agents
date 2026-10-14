// Offline sample data + a canned step stream, so the whole UI (including the live timeline)
// runs with VITE_USE_MOCK=1 and no backend. Mirrors the real API shapes in types.ts.
// This fakes the *transport*, never the agent's decisions: a mock-submitted email gets a
// neutral "needs review" structure, not an invented escalation.
import type {
  CreateEmailBody, EmailDetail, EmailRow, Health, PolicySection, Record, RunState, Stats, Step,
} from "./types";

import outbox from "../../../samples/outbox.json";

const inboxFiles = import.meta.glob("../../../data/inbox/E*.json", { eager: true }) as Record_mod;
const logFiles = import.meta.glob("../../../samples/logs/*.jsonl", {
  eager: true, query: "?raw", import: "default",
}) as { [path: string]: string };
const policyRaw = import.meta.glob("../../../data/policy.md", {
  eager: true, query: "?raw", import: "default",
}) as { [path: string]: string };
type Record_mod = { [path: string]: { default: InboxRaw } };

interface InboxRaw {
  id: string; from_name?: string; from_email?: string;
  subject?: string; body?: string; received_at?: string;
}

const records = new Map<string, Record>((outbox as Record[]).map((r) => [r.email_id, r]));

const inbox = new Map<string, InboxRaw>();
for (const mod of Object.values(inboxFiles)) inbox.set(mod.default.id, mod.default);

const steps = new Map<string, Step[]>();
for (const [path, raw] of Object.entries(logFiles)) {
  const id = path.split("/").pop()!.replace(".jsonl", "");
  steps.set(
    id,
    raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Step)
  );
}

// --- mutable state (mock runs mutate this) ---
const rows = new Map<string, EmailRow>();
for (const [id, raw] of inbox) {
  rows.set(id, {
    id,
    from_name: raw.from_name ?? "",
    from_email: raw.from_email ?? "",
    subject: raw.subject ?? "",
    received_at: raw.received_at ?? "",
    status: "done",
    record: records.get(id) ?? null,
  });
}
const bodies = new Map<string, string>([...inbox].map(([id, r]) => [id, r.body ?? ""]));
const liveSteps = new Map<string, Step[]>(steps);

let run: RunState = { running: false, total: 0, done: 0, llm_calls: 0, queued: 0, pending_ids: [], error: "" };
let mockSeq = 0;

// --- event bus (what sse.ts subscribes to in mock mode) ---
type MockEvent = { type: "step"; data: Step } | { type: "run"; data: RunState };
const listeners = new Set<(e: MockEvent) => void>();
export function subscribeMock(cb: (e: MockEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(e: MockEvent) {
  listeners.forEach((l) => l(e));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mock = {
  async getEmails(): Promise<EmailRow[]> {
    return [...rows.values()];
  },
  async getEmail(id: string): Promise<EmailDetail> {
    const row = rows.get(id);
    if (!row) throw new ApiError(404, "unknown email");
    return { ...row, body: bodies.get(id) ?? "", load_warnings: [], steps: liveSteps.get(id) ?? [] };
  },
  async getStats(): Promise<Stats> {
    const rs = [...records.values()];
    const by_category: { [k: string]: number } = {};
    const by_priority: { [k: string]: number } = {};
    let escalated = 0, fallback = 0, confSum = 0;
    for (const r of rs) {
      by_category[r.category] = (by_category[r.category] ?? 0) + 1;
      by_priority[r.priority] = (by_priority[r.priority] ?? 0) + 1;
      if (r.escalate) escalated++;
      if (r.confidence === 0) fallback++;
      confSum += r.confidence;
    }
    return {
      total: rs.length,
      emails_in_inbox: rows.size,
      escalated,
      needs_human_fallback: fallback,
      avg_confidence: rs.length ? confSum / rs.length : 0,
      by_category,
      by_priority,
    };
  },
  async getPolicy(): Promise<PolicySection[]> {
    return parsePolicy(Object.values(policyRaw)[0] ?? "");
  },
  async getRun(): Promise<RunState> {
    return run;
  },
  async getHealth(): Promise<Health> {
    return { status: "mock", model: "mock (no LLM)", llm_ready: false };
  },
  async createEmail(body: CreateEmailBody): Promise<{ id: string; processing: boolean; run: RunState }> {
    const id = `web-mock-${++mockSeq}`;
    rows.set(id, {
      id,
      from_name: body.from_name,
      from_email: body.from_email,
      subject: body.subject,
      received_at: new Date().toISOString(),
      status: body.process === false ? "pending" : "processing",
      record: null,
    });
    bodies.set(id, body.body);
    liveSteps.set(id, []);
    if (body.process !== false) void simulate(id);
    return { id, processing: body.process !== false, run };
  },
  async reprocess(id: string): Promise<RunState> {
    if (!rows.has(id)) throw new ApiError(404, "unknown email");
    liveSteps.set(id, []);
    rows.get(id)!.status = "processing";
    void simulate(id);
    return run;
  },
  async process(ids: string[] | null): Promise<RunState> {
    const targets = ids ?? [...rows.keys()];
    void (async () => {
      run = { ...run, running: true, total: targets.length, done: 0, error: "" };
      emit({ type: "run", data: run });
      for (const id of targets) {
        await simulate(id);
        run = { ...run, done: run.done + 1 };
        emit({ type: "run", data: run });
      }
      run = { ...run, running: false };
      emit({ type: "run", data: run });
    })();
    return run;
  },
};

// Canned step stream for a single email. Does not invent a decision: produces a neutral
// "needs review" record so mock mode never fakes an escalation or policy grounding.
async function simulate(id: string): Promise<void> {
  const row = rows.get(id);
  if (!row) return;
  row.status = "processing";
  run = { ...run, running: true };
  emit({ type: "run", data: run });

  const push = (s: Omit<Step, "email_id">) => {
    const step = { ...s, email_id: id } as Step;
    liveSteps.get(id)!.push(step);
    emit({ type: "step", data: step });
  };

  await sleep(600);
  push({ ts: now(), step: 1, decided_by: "model", provider: "mock", action: "LookupPolicy",
    reason: "Looking up relevant policy for this email.", args: { section: "Fees" }, result: "", latency_ms: 700 });
  await sleep(700);
  push({ ts: now(), step: 1, decided_by: "rule", provider: "mock", action: "lookup_result",
    reason: "returned FEE-1, FEE-2, FEE-3, FEE-4", args: {}, result: "", latency_ms: 0 });
  await sleep(900);
  push({ ts: now(), step: 2, decided_by: "model", provider: "mock", action: "Submit",
    reason: "Drafting a policy-grounded reply and decision.", args: {}, result: "", latency_ms: 900 });
  await sleep(700);

  const existing = records.get(id);
  const record: Record = existing ?? {
    email_id: id,
    category: "other",
    priority: "low",
    escalate: false,
    escalation_reason: "",
    policy_refs: [],
    reply_draft:
      `Dear ${row.from_name || "Student"},\n\nThank you for contacting the Student Helpdesk. ` +
      `This is a mock-mode draft (no live model), so no policy decision was made. ` +
      `Run against the backend for a real reply.\n\nStudent Helpdesk`,
    confidence: 0.5,
    agent_notes: "Mock mode: UI/transport demo only; the real decision comes from the backend agent.",
  };
  records.set(id, record);
  row.record = record;
  row.status = "done";
  push({ ts: now(), step: 2, decided_by: "rule", provider: "mock", action: "validate",
    reason: "accepted", args: {}, result: "", latency_ms: 0 });
  run = { ...run, running: false, done: run.done };
  emit({ type: "run", data: run });
}

const now = () => new Date().toISOString();

function parsePolicy(md: string): PolicySection[] {
  const sections: PolicySection[] = [];
  let current: PolicySection | null = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.+)/);
    if (h) {
      current = { section: h[1].trim(), clauses: [] };
      sections.push(current);
      continue;
    }
    const c = line.match(/^-\s+([A-Z]+-\d+):\s*(.+)/);
    if (c && current) current.clauses.push({ code: c[1], text: c[2].trim() });
  }
  return sections.filter((s) => s.clauses.length > 0);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
