import type { Step } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const num = (v: unknown) => (typeof v === "number" ? v : 0);

// Context engineering view: what the model saw and how big each part was (from the step-0 `context` row
// and the token counts on later steps). Sizes are characters; tokens are the model's own count when present.
export function ContextCard({ steps }: { steps: Step[] }) {
  const ctx = steps.find((s) => s.action === "context")?.meta;
  if (!ctx) return null;
  const lookups = steps.filter((s) => s.action === "lookup_result");
  const lookupChars = lookups.reduce((n, s) => n + num(s.meta?.chars), 0);
  const parts = [
    { label: "Agent rules", chars: num(ctx.system_chars), tone: "bg-primary" },
    { label: "Always-on policy (escalation + reply rules)", chars: num(ctx.always_on_policy_chars), tone: "bg-primary/60" },
    { label: "Email", chars: num(ctx.email_chars), tone: "bg-warn" },
    { label: "Pre-flag hints", chars: num(ctx.hint_chars), tone: "bg-danger" },
    { label: "Policy looked up by the agent (added during the run)", chars: lookupChars, tone: "bg-ok" },
  ].filter((p) => p.chars > 0);
  const total = parts.reduce((n, p) => n + p.chars, 0) || 1;
  const turns = steps.filter((s) => s.decided_by === "model" && s.action !== "reflect" && typeof s.meta?.input_tokens === "number");
  const maxIn = Math.max(1, ...turns.map((s) => num(s.meta?.input_tokens)));
  const hints = (ctx.hints as string[] | undefined) ?? [];

  return (
    <section aria-label="Context sent to the model" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Context</h2>
        <span className="nums text-xs text-muted-foreground">about {num(ctx.approx_tokens)} tokens on turn 1</span>
        {ctx.truncated === true && <Badge className="border-border">body shortened (head + tail kept)</Badge>}
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={parts.map((p) => `${p.label}: ${p.chars} characters`).join(", ")}>
        {parts.map((p) => <span key={p.label} className={p.tone} style={{ width: `${(p.chars / total) * 100}%` }} />)}
      </div>
      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${p.tone}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={p.label}>{p.label}</span>
            <span className="nums">{Math.round((p.chars / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      {hints.length > 0 && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-xs">
          <p className="font-medium text-danger">Pre-flags the code gave the model (advisory, the model decides)</p>
          <ul className="mt-1 list-disc pl-4 text-muted-foreground">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
      )}
      {turns.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Input tokens per model turn (the context grows as tool results arrive)</p>
          <ul className="space-y-1">
            {turns.map((s, i) => (
              <li key={i} className="flex min-w-0 items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate text-muted-foreground">turn {s.step}: {s.action}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(num(s.meta?.input_tokens) / maxIn) * 100}%` }} />
                </span>
                <span className="nums w-20 shrink-0 text-right text-muted-foreground">{num(s.meta?.input_tokens)} in / {num(s.meta?.output_tokens)} out</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
