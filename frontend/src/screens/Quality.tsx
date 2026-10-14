import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { EvalRun } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { ErrorState } from "@/components/ErrorState";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]", className)}>
      {children}
    </div>
  );
}

function RunCard({ title, note, cmd, run }: { title: string; note: string; cmd: string; run: EvalRun | null }) {
  return (
    <Panel>
      <div className="mb-3">
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        <p className="text-xs text-[var(--ink-2)]">{note}</p>
      </div>
      {!run ? (
        <p className="text-sm text-[var(--ink-2)]">
          No saved run yet. Run <code className="font-mono text-xs text-brand">{cmd}</code>.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm">
            <b className="nums text-ink">{run.total - run.failed} of {run.total}</b>
            <span className="text-[var(--ink-2)]"> cases passed · {relativeTime(run.ts)} · {run.llm_calls} LLM calls</span>
          </p>
          <ul className="space-y-1.5">
            {run.cases.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex items-center gap-2">
                  {c.passed
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-lo" aria-label="passed" />
                    : <XCircle className="h-4 w-4 shrink-0 text-hi" aria-label="failed" />}
                  <span className="font-mono text-xs text-[var(--ink-3)]">{c.id}</span>
                  <span className="min-w-0 truncate text-xs text-[var(--ink-2)]">
                    {c.category}/{c.priority}{c.escalate ? " · escalated" : ""}{c.refs?.length ? ` · ${c.refs.join(", ")}` : ""}
                  </span>
                </div>
                {c.problems.map((p) => <p key={p} className="ml-6 text-xs text-hi">{p}</p>)}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export default function Quality() {
  const ev = useAsync(() => api.getEvals(), []);
  if (ev.loading && !ev.data) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (ev.error && !ev.data) return <ErrorState message={ev.error} onRetry={ev.reload} />;
  if (!ev.data) return null;
  const { saved, live } = ev.data;
  const failing = live.rows.filter((r) => !r.passed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-[-0.025em] text-ink">Quality</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Property checks run on every saved row for free; case suites run against the real model.
          </p>
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-line-2 hover:text-ink"
          onClick={ev.reload}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Re-check
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Rows checked" value={live.checked} hint="current outbox" />
        <StatCard label="Property failures" value={live.failed} tone={live.failed ? "danger" : "default"} hint="schema, limits, codes, contacts" />
        <StatCard label="Tuning cases" value={saved.cases ? `${saved.cases.total - saved.cases.failed}/${saved.cases.total}` : "-"} />
        <StatCard label="Held-out cases" value={saved.heldout ? `${saved.heldout.total - saved.heldout.failed}/${saved.heldout.total}` : "-"} />
      </div>

      {failing.length > 0 && (
        <Panel>
          <h2 className="mb-3 font-display text-[15px] font-semibold text-hi">Rows failing the property checks</h2>
          <div className="space-y-2">
            {failing.map((r) => (
              <div key={r.id} className="text-sm">
                <Link to={`/emails/${encodeURIComponent(r.id)}`} className="font-mono text-xs text-brand hover:underline">{r.id}</Link>
                {r.problems.map((p) => <p key={p} className="text-xs text-hi">{p}</p>)}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RunCard
          title="Tuning cases"
          cmd="python evals/run_evals.py"
          note="Used while improving the prompt, so a pass here is not proof of generalisation."
          run={saved.cases}
        />
        <RunCard
          title="Held-out cases"
          cmd="python evals/run_evals.py --heldout"
          note="Kept aside and run at the gate. One case was fixed after it failed, so it is partly used."
          run={saved.heldout}
        />
      </div>
    </div>
  );
}
