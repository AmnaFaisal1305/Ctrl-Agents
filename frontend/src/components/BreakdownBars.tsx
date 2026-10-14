import { prettyCategory } from "@/lib/format";
import { cn } from "@/lib/cn";

// Simple, readable horizontal bars (Design allows "charts or bars"; no chart library needed).
export function BreakdownBars({
  title, data, order, tone,
}: {
  title: string;
  data: { [k: string]: number };
  order?: string[]; // optional fixed order (e.g. high, medium, low)
  tone?: (key: string) => string; // optional bar color class per key
}) {
  const entries = Object.entries(data);
  const keys = order ? order.filter((k) => k in data) : entries.map(([k]) => k).sort((a, b) => data[b] - data[a]);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 truncate capitalize text-muted-foreground">{prettyCategory(k)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className={cn("block h-full rounded-full bg-primary", tone?.(k))}
                style={{ width: `${(data[k] / max) * 100}%` }}
              />
            </span>
            <span className="nums w-6 shrink-0 text-right text-xs text-muted-foreground">{data[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
