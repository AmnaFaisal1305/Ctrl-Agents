import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  if (value === 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-hi", className)}>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Needs a human
      </span>
    );
  }
  const pct = Math.round(value * 100);
  const barCls = pct < 50 ? "bg-hi" : pct < 80 ? "bg-[var(--md-bar)]" : "bg-lo";
  const textCls = pct < 50 ? "text-hi" : pct < 80 ? "text-[var(--md)]" : "text-[var(--ink-3)]";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`Confidence ${pct}%`}>
      <span className="h-[5px] w-24 overflow-hidden rounded-full bg-line-2" aria-hidden>
        <span
          className={cn("block h-full rounded-full transition-all", barCls)}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={cn("nums w-8 text-right text-xs font-medium", textCls)}>{pct}%</span>
    </span>
  );
}
