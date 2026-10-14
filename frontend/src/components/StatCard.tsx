import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function StatCard({
  label, value, hint, tone, icon: Icon, chipColor,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "danger" | "warn" | "default";
  icon?: LucideIcon;
  chipColor?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(21,18,43,0.04)]">
      {Icon && (
        <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]", chipColor ?? "bg-line-2 text-[var(--ink-3)]")}>
          <Icon className="h-[19px] w-[19px]" aria-hidden />
        </div>
      )}
      <p className="text-xs font-medium text-[var(--ink-2)]">{label}</p>
      <p
        className={cn(
          "nums mt-1 font-display text-2xl font-bold tracking-tight text-ink",
          tone === "danger" && "text-hi",
          tone === "warn" && "text-[var(--md)]"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--ink-3)]">{hint}</p> : null}
    </div>
  );
}
