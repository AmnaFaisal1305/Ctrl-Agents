import { CheckCircle2, AlertTriangle, CircleSlash } from "lucide-react";
import type { Step } from "@/lib/types";

type Issue = { aspect: string; note: string };

// Shadow review by a second model call. It is shown for transparency and never changes the decision.
export function ReflectionCard({ steps }: { steps: Step[] }) {
  const row = steps.find((s) => s.action === "reflect");
  const failed = steps.some((s) => s.action === "reflect_failed");
  if (!row && !failed) return null;
  const issues = ((row?.meta?.issues as Issue[] | undefined) ?? []);
  const ok = row?.meta?.verdict === "ok";

  return (
    <section aria-label="Reflection" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Reflection</h2>
        {failed && !row ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CircleSlash className="h-3.5 w-3.5" aria-hidden /> critic unavailable, decision unchanged</span>
        ) : ok ? (
          <span className="inline-flex items-center gap-1 text-xs text-ok"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> critic agrees</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-warn"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {issues.length} concern(s) raised</span>
        )}
        {row && row.latency_ms > 0 && <span className="nums ml-auto text-xs text-muted-foreground">{row.latency_ms} ms</span>}
      </div>
      {issues.length > 0 && (
        <ul className="space-y-1.5">
          {issues.map((i, k) => (
            <li key={k} className="rounded-md bg-warn-soft px-3 py-2 text-sm">
              <span className="mr-2 rounded border border-warn/40 px-1.5 py-0.5 font-mono text-xs text-warn">{i.aspect}</span>
              <span className="text-muted-foreground">{i.note}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">A second model reviews the final record against the rules. It reports only; the saved row is not changed.</p>
    </section>
  );
}
