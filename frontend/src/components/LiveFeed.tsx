import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import type { Step } from "@/lib/types";
import { cn } from "@/lib/cn";

// Compact stream of recent agent steps across all emails (SSE `step` events).
export function LiveFeed({ steps }: { steps: Step[] }) {
  return (
    <section aria-label="Live agent feed" className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Radio className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Live feed</h2>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Steps appear here while the agent runs.</p>
      ) : (
        <ol aria-live="polite" className="space-y-1 overflow-y-auto text-xs">
          {steps.map((s, i) => (
            <li key={i} className="animate-slide-in">
              <Link
                to={`/emails/${s.email_id}`}
                className="flex flex-wrap items-baseline gap-x-1.5 rounded px-1 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-mono text-muted-foreground">{s.email_id}</span>
                <span className="text-muted-foreground">· step {s.step} ·</span>
                <span className={cn("font-medium", s.decided_by === "rule" ? "text-muted-foreground" : "text-primary")}>
                  {s.decided_by}
                </span>
                <span className="font-medium">{s.action}</span>
                <span className="w-full truncate text-muted-foreground">{s.reason}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
