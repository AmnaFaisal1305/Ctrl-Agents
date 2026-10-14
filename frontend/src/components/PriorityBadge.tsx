import type { Priority } from "@/lib/types";
import { cn } from "@/lib/cn";

const MAP: Record<Priority, { label: string; bars: number; cls: string; barCls: string }> = {
  high: { label: "High", bars: 3, cls: "text-hi", barCls: "bg-hi" },
  medium: { label: "Medium", bars: 2, cls: "text-[var(--md)]", barCls: "bg-[var(--md-bar)]" },
  low: { label: "Low", bars: 1, cls: "text-lo", barCls: "bg-lo" },
};

function SignalBars({ filled, barCls }: { filled: number; barCls: string }) {
  return (
    <span className="inline-flex items-end gap-[2px] h-[13px] flex-none" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-1 rounded-[1px]", i < filled ? barCls : "bg-line")}
          style={{ height: `${5 + i * 4}px` }}
        />
      ))}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, bars, cls, barCls } = MAP[priority] ?? MAP.low;
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13.5px] font-semibold", cls)}>
      <SignalBars filled={bars} barCls={barCls} />
      {label}
    </span>
  );
}
