import { Loader2 } from "lucide-react";
import type { EmailStatus, Step } from "@/lib/types";
import { StepItem } from "./StepItem";

export function StepTimeline({ steps, status }: { steps: Step[]; status: EmailStatus }) {
  return (
    <section aria-label="Agent step timeline">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Agent reasoning</h2>
        {status === "processing" && (
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            thinking…
          </span>
        )}
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "processing" ? "Waiting for the first step…" : "No steps recorded."}
        </p>
      ) : (
        // polite live region so the timeline is announced as it fills during a live run
        <ol aria-live="polite" className="relative">
          {steps.map((s, i) => (
            <StepItem key={`${s.step}-${s.action}-${i}`} step={s} last={i === steps.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}
