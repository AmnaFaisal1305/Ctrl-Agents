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
