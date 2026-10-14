// Mirrors Design.md sections 5 and 7. Keep in sync with the backend contract.

export type Priority = "low" | "medium" | "high";
export type EmailStatus = "pending" | "processing" | "done";
export type DecidedBy = "model" | "rule";

// Open set: these are the known categories, but any string must still render (generic chip).
export type KnownCategory =
  | "fee" | "hostel" | "academic" | "technical"
  | "wellbeing" | "harassment" | "legal_media" | "security" | "other";
export type Category = KnownCategory | (string & {});

// The 9 contest fields.
export interface Record {
  email_id: string;
  category: Category;
  priority: Priority;
  escalate: boolean;
  escalation_reason: string;
  policy_refs: string[];
  reply_draft: string;
  confidence: number;
  agent_notes: string;
}

export interface Step {
  ts: string;
  email_id: string;
  step: number;
  decided_by: DecidedBy;
  provider: string;
  action: string; // LookupPolicy | lookup_result | Submit | validate | safety_net | fallback | no_tool_call
  reason: string; // free text; for validate: "accepted" or "rejected: CODE: message"
  args: Record_args;
  result: string;
  latency_ms: number;
  meta?: Record_args; // observability data: tokens, context sizes, critic verdict
}
type Record_args = { [k: string]: unknown };

// Queue row from GET /api/emails
export interface EmailRow {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  received_at: string;
  status: EmailStatus;
  record: Record | null;
}

// GET /api/emails/{id}
export interface EmailDetail extends EmailRow {
  body: string;
  load_warnings: string[];
  steps: Step[];
}

export interface Stats {
  total: number;
  emails_in_inbox: number;
  escalated: number;
  needs_human_fallback: number;
  avg_confidence: number;
  by_category: { [k: string]: number };
  by_priority: { [k: string]: number };
}

export interface RunState {
  running: boolean;
  total: number;
  done: number;
  llm_calls: number;
  queued: number;
  pending_ids: string[];
  error: string;
}

export interface PolicyClause {
  code: string;
  text: string;
}
export interface PolicySection {
  section: string;
  clauses: PolicyClause[];
}

export interface Health {
  status: string;
  model: string;
  llm_ready: boolean;
}

export interface CreateEmailBody {
  from_name: string;
  from_email: string;
  subject: string;
  body: string;
  process?: boolean;
}

// GET /api/metrics, /api/harness, /api/evals (read-only observability over logs/)
export interface EmailMetric {
  email_id: string;
  model_calls: number;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  outcome: "accepted" | "safety_net" | "fallback";
  rejections: number;
  self_healed: boolean;
  context_tokens: number;
  hints: string[];
  critic: "ok" | "concerns" | "failed" | null;
}
export interface Metrics {
  emails: number;
  llm_calls: number;
  input_tokens: number;
  output_tokens: number;
  latency_ms: { p50: number; p95: number; critic_p50: number };
  tool_usage: { [k: string]: number };
  outcomes: { [k: string]: number };
  recovery: { rejections_by_code: { [k: string]: number }; self_healed: number; fallbacks: number; safety_net: number };
  critic: { verdicts: { [k: string]: number }; aspects: { [k: string]: number } };
  context: { avg_tokens: number; hinted_emails: number; truncated_emails: number };
  per_email: EmailMetric[];
}
export interface Harness {
  model: string;
  temperature: number;
  timeout_s: number;
  sdk_retries: number;
  workers: number;
  max_model_turns: number;
  max_revisions: number;
  word_limit: number;
  body_limit_chars: number;
  reflection: boolean;
  guards: { name: string; detail: string }[];
}
export interface EvalCase {
  id: string;
  passed: boolean;
  problems: string[];
  category?: string;
  priority?: string;
  escalate?: boolean;
  refs?: string[];
}
export interface EvalRun {
  ts: string;
  llm_calls: number;
  total: number;
  failed: number;
  cases: EvalCase[];
}
export interface EvalsResponse {
  saved: { cases: EvalRun | null; heldout: EvalRun | null };
  live: { checked: number; failed: number; rows: { id: string; passed: boolean; problems: string[] }[] };
}
