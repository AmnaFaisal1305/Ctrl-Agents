import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { EvalRun } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { ErrorState } from "@/components/ErrorState";
import { relativeTime } from "@/lib/format";

function RunCard({ title, note, cmd, run }: { title: string; note: string; cmd: string; run: EvalRun | null }) {
  return (
    <Card><CardContent className="space-y-3 pt-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      {!run ? <p className="text-sm text-muted-foreground">No saved run yet. Run <code className="font-mono text-xs">{cmd}</code>.</p> : (
        <>
          <p className="text-sm"><b className="nums">{run.total - run.failed} of {run.total}</b> cases passed
            <span className="text-muted-foreground"> · {relativeTime(run.ts)} · {run.llm_calls} LLM calls</span></p>
          <ul className="space-y-1">
            {run.cases.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex items-center gap-2">
                  {c.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-label="passed" /> : <XCircle className="h-4 w-4 shrink-0 text-danger" aria-label="failed" />}
                  <span className="font-mono text-xs">{c.id}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{c.category}/{c.priority}{c.escalate ? " · escalated" : ""}{c.refs?.length ? ` · ${c.refs.join(", ")}` : ""}</span>
                </div>
                {c.problems.map((p) => <p key={p} className="ml-6 text-xs text-danger">{p}</p>)}
              </li>
            ))}
          </ul>
        </>
      )}
    </CardContent></Card>
  );
}

export default function Quality() {
  const ev = useAsync(() => api.getEvals(), []);
  if (ev.loading && !ev.data) return <Skeleton className="h-96 w-full" />;
  if (ev.error && !ev.data) return <ErrorState message={ev.error} onRetry={ev.reload} />;
  if (!ev.data) return null;
  const { saved, live } = ev.data;
  const failing = live.rows.filter((r) => !r.passed);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold">Quality</h1>
          <p className="text-sm text-muted-foreground">Property checks run on every saved row for free; case suites run against the real model.</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={ev.reload}><RefreshCw className="h-3.5 w-3.5" /> Re-check</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Rows checked" value={live.checked} hint="current outbox" />
        <StatCard label="Property failures" value={live.failed} tone={live.failed ? "danger" : "default"} hint="schema, limits, codes, contacts" />
        <StatCard label="Tuning cases" value={saved.cases ? `${saved.cases.total - saved.cases.failed}/${saved.cases.total}` : "-"} />
        <StatCard label="Held-out cases" value={saved.heldout ? `${saved.heldout.total - saved.heldout.failed}/${saved.heldout.total}` : "-"} />
      </div>

      {failing.length > 0 && (
        <Card><CardContent className="space-y-2 pt-4">
          <h2 className="text-sm font-semibold text-danger">Rows failing the property checks</h2>
          {failing.map((r) => (
            <div key={r.id} className="text-sm">
              <Link to={`/emails/${encodeURIComponent(r.id)}`} className="font-mono text-xs text-primary hover:underline">{r.id}</Link>
              {r.problems.map((p) => <p key={p} className="text-xs text-danger">{p}</p>)}
            </div>
          ))}
        </CardContent></Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RunCard title="Tuning cases" cmd="python evals/run_evals.py" note="Used while improving the prompt, so a pass here is not proof of generalisation." run={saved.cases} />
        <RunCard title="Held-out cases" cmd="python evals/run_evals.py --heldout" note="Kept aside and run at the gate. One case was fixed after it failed, so it is partly used." run={saved.heldout} />
      </div>
    </div>
  );
}
