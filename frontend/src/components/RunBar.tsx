import { useState } from "react";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { RunState } from "@/lib/types";
import { cn } from "@/lib/cn";

export function RunBar({ run, onProcessAll }: { run: RunState | null; onProcessAll: (onlyNew: boolean) => void }) {
  const [onlyNew, setOnlyNew] = useState(false);
  const running = run?.running ?? false;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => onProcessAll(onlyNew)}
        disabled={running}
        className={cn(
          "inline-flex items-center gap-2 rounded-[11px] px-4 h-10 text-sm font-semibold text-white transition-all active:scale-[0.97]",
          running
            ? "cursor-not-allowed bg-ink opacity-80"
            : "bg-brand shadow-[0_4px_14px_rgba(91,75,255,0.35)] hover:bg-brand-ink hover:shadow-[0_6px_20px_rgba(91,75,255,0.45)]"
        )}
      >
        {running ? (
          <>
            <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 flex-none" />
            Process all
          </>
        )}
      </button>

      {running ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand animate-blink">
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand" />
          Running
        </span>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink-2)]">
          <Checkbox
            id="only-new"
            checked={onlyNew}
            onCheckedChange={(v) => setOnlyNew(v === true)}
          />
          <Label htmlFor="only-new" className="cursor-pointer font-normal text-[var(--ink-2)]">
            Skip emails that haven't changed
          </Label>
        </label>
      )}

      {running && (
        <span className="nums text-sm text-[var(--ink-3)]" aria-live="polite">
          {run?.done ?? 0} / {run?.total ?? 0}
          {run && run.queued > 0 ? ` · ${run.queued} queued` : ""}
        </span>
      )}

      {run?.error ? (
        <span className="inline-flex items-center gap-1 text-sm text-hi">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {run.error}
        </span>
      ) : null}
    </div>
  );
}
