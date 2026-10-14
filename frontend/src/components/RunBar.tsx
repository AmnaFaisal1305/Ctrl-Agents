import { useState } from "react";
import { Loader2, Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { RunState } from "@/lib/types";

export function RunBar({ run, onProcessAll }: { run: RunState | null; onProcessAll: (onlyNew: boolean) => void }) {
  const [onlyNew, setOnlyNew] = useState(false);
  const running = run?.running ?? false;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3">
      <Button onClick={() => onProcessAll(onlyNew)} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? "Processing…" : "Process all"}
      </Button>

      <div className="flex items-center gap-2">
        <Checkbox id="only-new" checked={onlyNew} onCheckedChange={(v) => setOnlyNew(v === true)} disabled={running} />
        <Label htmlFor="only-new" className="cursor-pointer text-sm font-normal text-muted-foreground">
          Only new / unchanged skipped
        </Label>
      </div>

      {running && (
        <span className="nums text-sm text-muted-foreground" aria-live="polite">
          {run?.done ?? 0} / {run?.total ?? 0}
          {run && run.queued > 0 ? ` · ${run.queued} queued` : ""}
        </span>
      )}

      {run?.error ? (
        <span className="inline-flex items-center gap-1 text-sm text-danger">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {run.error}
        </span>
      ) : null}
    </div>
  );
}
