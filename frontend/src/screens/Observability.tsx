import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { BreakdownBars } from "@/components/BreakdownBars";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");

export default function Observability() {
  const m = useAsync(() => api.getMetrics(), []);
  const h = useAsync(() => api.getHarness(), []);

  if ((m.loading && !m.data) || (h.loading && !h.data)) return <Skeleton className="h-96 w-full" />;
  if (m.error && !m.data) return <ErrorState message={m.error} onRetry={m.reload} />;
  if (h.error && !h.data) return <ErrorState message={h.error} onRetry={h.reload} />;
  if (!m.data || !h.data) return null;
  const d = m.data, harness = h.data;
  if (d.emails === 0) return <EmptyState title="No traces yet" hint="Process an email and its step log will be summarised here." />;
  const verdicts = d.critic.verdicts;
  const reviewed = (verdicts.ok ?? 0) + (verdicts.concerns ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold">Observability</h1>
          <p className="text-sm text-muted-foreground">Traces from the step logs of the latest run of each email. Everything stays on this machine.</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => { m.reload(); h.reload(); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Emails traced" value={d.emails} />
        <StatCard label="Model calls" value={d.llm_calls} hint="agent turns + critic" />
        <StatCard label="Tokens in / out" value={`${d.input_tokens.toLocaleString()} / ${d.output_tokens.toLocaleString()}`} />
        <StatCard label="Latency p50 / p95" value={`${secs(d.latency_ms.p50)} / ${secs(d.latency_ms.p95)}`} hint="per agent turn" />
        <StatCard label="Fallback rows" value={d.recovery.fallbacks} tone={d.recovery.fallbacks ? "danger" : "default"} hint={pct(d.recovery.fallbacks, d.emails)} />
        <StatCard label="Self-healed" value={d.recovery.self_healed} hint="rejected, then fixed" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardContent className="space-y-5 pt-4">
          <h2 className="text-sm font-semibold">Error recovery</h2>
          <p className="text-xs text-muted-foreground">
            Validators send a bad submit back to the model; it gets {harness.max_revisions} revisions before a safe fallback row.
          </p>
          {Object.keys(d.recovery.rejections_by_code).length ? (
            <BreakdownBars title="Validator rejections by code" data={d.recovery.rejections_by_code} tone={() => "bg-warn"} />
          ) : <p className="text-sm text-muted-foreground">No validator rejections in the current logs.</p>}
          <div className="flex flex-wrap gap-4 text-sm">
            <span><b className="nums">{d.recovery.self_healed}</b> self-healed</span>
            <span><b className="nums">{d.recovery.safety_net}</b> safety-net escalations</span>
            <span><b className="nums">{d.recovery.fallbacks}</b> fallback rows</span>
          </div>
        </CardContent></Card>

        <Card><CardContent className="space-y-5 pt-4">
          <h2 className="text-sm font-semibold">Agent behaviour</h2>
          <BreakdownBars title="Model actions" data={d.tool_usage} />
          <BreakdownBars title="Outcomes" data={d.outcomes} tone={(k) => (k === "fallback" ? "bg-danger" : k === "safety_net" ? "bg-warn" : "bg-ok")} />
        </CardContent></Card>

        <Card><CardContent className="space-y-4 pt-4">
          <h2 className="text-sm font-semibold">Harness</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {([
              ["Model", harness.model], ["Temperature", harness.temperature], ["Turns per email", harness.max_model_turns],
              ["Revisions", harness.max_revisions], ["Timeout", `${harness.timeout_s} s`], ["SDK retries", harness.sdk_retries],
              ["Reply limit", `${harness.word_limit} words`], ["Body limit", `${harness.body_limit_chars} chars`],
            ] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="nums text-right">{v}</dd></div>
            ))}
          </dl>
          <ul className="space-y-2">
            {harness.guards.map((g) => (
              <li key={g.name} className="text-sm"><span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground"> · {g.detail}</span></li>
            ))}
          </ul>
        </CardContent></Card>

        <Card><CardContent className="space-y-5 pt-4">
          <h2 className="text-sm font-semibold">Reflection and context</h2>
          {reviewed ? (
            <>
              <p className="text-sm">The critic agreed on <b className="nums">{verdicts.ok ?? 0}</b> of <b className="nums">{reviewed}</b> reviewed emails
                {verdicts.failed ? ` (${verdicts.failed} critic failures, decisions unchanged)` : ""}.</p>
              {Object.keys(d.critic.aspects).length > 0 && <BreakdownBars title="Concerns by aspect" data={d.critic.aspects} tone={() => "bg-warn"} />}
            </>
          ) : <p className="text-sm text-muted-foreground">No critic reviews in the current logs.{harness.reflection ? "" : " Reflection is off (REFLECT=0)."}</p>}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Avg context, turn 1</dt><dd className="nums text-right">{d.context.avg_tokens} tokens</dd>
            <dt className="text-muted-foreground">Emails with pre-flag hints</dt><dd className="nums text-right">{d.context.hinted_emails}</dd>
            <dt className="text-muted-foreground">Bodies shortened</dt><dd className="nums text-right">{d.context.truncated_emails}</dd>
          </dl>
        </CardContent></Card>
      </div>

      <Card><CardContent className="pt-4">
        <h2 className="mb-3 text-sm font-semibold">Per email</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Email</th><th className="pr-3 font-medium">Calls</th><th className="pr-3 font-medium">Tokens in/out</th>
              <th className="pr-3 font-medium">Time</th><th className="pr-3 font-medium">Rejections</th><th className="pr-3 font-medium">Outcome</th><th className="font-medium">Critic</th>
            </tr></thead>
            <tbody>
              {d.per_email.map((e) => (
                <tr key={e.email_id} className="border-b last:border-0">
                  <td className="py-1.5 pr-3"><Link className="font-mono text-xs text-primary hover:underline" to={`/emails/${encodeURIComponent(e.email_id)}`}>{e.email_id}</Link></td>
                  <td className="nums pr-3">{e.model_calls}</td>
                  <td className="nums pr-3">{e.input_tokens} / {e.output_tokens}</td>
                  <td className="nums pr-3">{secs(e.latency_ms)}</td>
                  <td className="nums pr-3">{e.rejections}{e.self_healed ? " (healed)" : ""}</td>
                  <td className={cn("pr-3", e.outcome === "fallback" && "text-danger", e.outcome === "safety_net" && "text-warn")}>{e.outcome.replace("_", " ")}</td>
                  <td className={cn(e.critic === "concerns" && "text-warn")}>{e.critic ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}
