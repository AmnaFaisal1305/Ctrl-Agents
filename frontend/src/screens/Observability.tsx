import { Link } from "react-router-dom";
import { RefreshCw, Activity, Zap, Clock, AlertTriangle, HeartPulse } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { BreakdownBars } from "@/components/BreakdownBars";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]", className)}>
      {children}
    </div>
  );
}

export default function Observability() {
  const m = useAsync(() => api.getMetrics(), []);
  const h = useAsync(() => api.getHarness(), []);

  if ((m.loading && !m.data) || (h.loading && !h.data)) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (m.error && !m.data) return <ErrorState message={m.error} onRetry={m.reload} />;
  if (h.error && !h.data) return <ErrorState message={h.error} onRetry={h.reload} />;
  if (!m.data || !h.data) return null;
  const d = m.data, harness = h.data;
  if (d.emails === 0) return <EmptyState title="No traces yet" hint="Process an email and its step log will be summarised here." />;
  const verdicts = d.critic.verdicts;
  const reviewed = (verdicts.ok ?? 0) + (verdicts.concerns ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-[-0.025em] text-ink">Observability</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">Traces from step logs of the latest run. Everything stays on this machine.</p>
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-line-2 hover:text-ink"
          onClick={() => { m.reload(); h.reload(); }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Emails traced" value={d.emails} icon={Activity} />
        <StatCard label="Model calls" value={d.llm_calls} hint="agent turns + critic" icon={Zap} />
        <StatCard label="Tokens in / out" value={`${d.input_tokens.toLocaleString()} / ${d.output_tokens.toLocaleString()}`} />
        <StatCard label="Latency p50 / p95" value={`${secs(d.latency_ms.p50)} / ${secs(d.latency_ms.p95)}`} hint="per agent turn" icon={Clock} />
        <StatCard label="Fallback rows" value={d.recovery.fallbacks} tone={d.recovery.fallbacks ? "danger" : "default"} hint={pct(d.recovery.fallbacks, d.emails)} icon={AlertTriangle} />
        <StatCard label="Self-healed" value={d.recovery.self_healed} hint="rejected, then fixed" icon={HeartPulse} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 font-display text-[15px] font-semibold text-ink">Error recovery</h2>
          <p className="mb-4 text-xs text-[var(--ink-2)]">
            Validators send a bad submit back to the model; it gets {harness.max_revisions} revisions before a safe fallback row.
          </p>
          {Object.keys(d.recovery.rejections_by_code).length ? (
            <BreakdownBars title="Validator rejections by code" data={d.recovery.rejections_by_code} tone={() => "bg-warn"} />
          ) : <p className="text-sm text-[var(--ink-2)]">No validator rejections in the current logs.</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--ink-2)]">
            <span><b className="nums text-ink">{d.recovery.self_healed}</b> self-healed</span>
            <span><b className="nums text-ink">{d.recovery.safety_net}</b> safety-net escalations</span>
            <span><b className="nums text-ink">{d.recovery.fallbacks}</b> fallback rows</span>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 font-display text-[15px] font-semibold text-ink">Agent behaviour</h2>
          <BreakdownBars title="Model actions" data={d.tool_usage} />
          <BreakdownBars title="Outcomes" data={d.outcomes} tone={(k) => (k === "fallback" ? "bg-danger" : k === "safety_net" ? "bg-warn" : "bg-ok")} />
        </Panel>

        <Panel>
          <h2 className="mb-4 font-display text-[15px] font-semibold text-ink">Harness</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {([
              ["Model", harness.model], ["Temperature", harness.temperature], ["Turns per email", harness.max_model_turns],
              ["Revisions", harness.max_revisions], ["Timeout", `${harness.timeout_s} s`], ["SDK retries", harness.sdk_retries],
              ["Reply limit", `${harness.word_limit} words`], ["Body limit", `${harness.body_limit_chars} chars`],
            ] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--ink-2)]">{k}</dt>
                <dd className="nums text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {harness.guards.length > 0 && (
            <ul className="mt-4 space-y-2">
              {harness.guards.map((g) => (
                <li key={g.name} className="text-sm">
                  <span className="font-medium text-ink">{g.name}</span>
                  <span className="text-[var(--ink-2)]"> · {g.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-4 font-display text-[15px] font-semibold text-ink">Reflection and context</h2>
          {reviewed ? (
            <>
              <p className="text-sm text-[var(--ink-2)]">
                The critic agreed on <b className="nums text-ink">{verdicts.ok ?? 0}</b> of <b className="nums text-ink">{reviewed}</b> reviewed emails
                {verdicts.failed ? ` (${verdicts.failed} critic failures, decisions unchanged)` : ""}.
              </p>
              {Object.keys(d.critic.aspects).length > 0 && (
                <div className="mt-4">
                  <BreakdownBars title="Concerns by aspect" data={d.critic.aspects} tone={() => "bg-warn"} />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--ink-2)]">
              No critic reviews in the current logs.{harness.reflection ? "" : " Reflection is off (REFLECT=0)."}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-[var(--ink-2)]">Avg context, turn 1</dt><dd className="nums text-right text-ink">{d.context.avg_tokens} tokens</dd>
            <dt className="text-[var(--ink-2)]">Emails with pre-flag hints</dt><dd className="nums text-right text-ink">{d.context.hinted_emails}</dd>
            <dt className="text-[var(--ink-2)]">Bodies shortened</dt><dd className="nums text-right text-ink">{d.context.truncated_emails}</dd>
          </dl>
        </Panel>
      </div>

      <Panel>
        <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">Per email</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-[var(--ink-3)]">
                <th className="py-1.5 pr-3 font-medium">Email</th>
                <th className="pr-3 font-medium">Calls</th>
                <th className="pr-3 font-medium">Tokens in/out</th>
                <th className="pr-3 font-medium">Time</th>
                <th className="pr-3 font-medium">Rejections</th>
                <th className="pr-3 font-medium">Outcome</th>
                <th className="font-medium">Critic</th>
              </tr>
            </thead>
            <tbody>
              {d.per_email.map((e) => (
                <tr key={e.email_id} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3">
                    <Link className="font-mono text-xs text-brand hover:underline" to={`/emails/${encodeURIComponent(e.email_id)}`}>{e.email_id}</Link>
                  </td>
                  <td className="nums pr-3 text-ink">{e.model_calls}</td>
                  <td className="nums pr-3 text-ink">{e.input_tokens} / {e.output_tokens}</td>
                  <td className="nums pr-3 text-ink">{secs(e.latency_ms)}</td>
                  <td className="nums pr-3 text-ink">{e.rejections}{e.self_healed ? " (healed)" : ""}</td>
                  <td className={cn("pr-3", e.outcome === "fallback" ? "text-hi" : e.outcome === "safety_net" ? "text-[var(--md)]" : "text-ink")}>
                    {e.outcome.replace("_", " ")}
                  </td>
                  <td className={cn(e.critic === "concerns" ? "text-[var(--md)]" : "text-ink")}>{e.critic ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
