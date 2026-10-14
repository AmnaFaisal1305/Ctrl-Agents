import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

// confidence == 0 is a fallback row ("needs a human"); < 0.5 is a muted "uncertain" style.
export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  if (value === 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-danger", className)}>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Needs a human
      </span>
    );
  }
  const pct = Math.round(value * 100);
  const uncertain = value < 0.5;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`Confidence ${pct}%`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn("block h-full rounded-full", uncertain ? "bg-warn" : "bg-ok")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={cn("nums text-xs", uncertain ? "text-warn" : "text-muted-foreground")}>
        {pct}%{uncertain ? " · uncertain" : ""}
      </span>
    </span>
  );
}
