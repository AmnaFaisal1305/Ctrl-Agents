import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import type { Step } from "@/lib/types";
import { cn } from "@/lib/cn";

function dotClass(s: Step): string {
  if (s.action === "validate" && s.reason?.startsWith("accepted")) return "bg-lo";
  if (s.action === "fallback" || s.action === "safety_net") return "bg-hi";
  if (s.decided_by === "model") return "bg-brand/60";
  return "bg-[#C9C6DF]";
}

export function LiveFeed({ steps }: { steps: Step[] }) {
  return (
    <section aria-label="Live agent feed" className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Radio className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-ink">Live feed</h2>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">
          Steps appear here while the agent runs. Select Process all to start.
        </p>
      ) : (
        <ol aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-1">
          {steps.map((s, i) => (
            <li key={i} className="relative animate-slide-in pb-3 pl-5 text-[13.5px] leading-snug">
              {/* dot */}
              <span className={cn("absolute left-[3px] top-[5px] h-2 w-2 rounded-full", dotClass(s))} />
              {/* connector line */}
              {i < steps.length - 1 && (
                <span className="absolute bottom-0 left-[6.5px] top-[17px] w-px bg-line" />
              )}
              <Link
                to={`/emails/${s.email_id}`}
                className={cn(
                  "block rounded px-1 hover:bg-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  s.action === "validate" || s.action === "fallback"
                    ? "font-medium text-ink"
                    : "text-[var(--ink-2)]"
                )}
              >
                <span className="font-mono text-[var(--ink-3)]">{s.email_id.slice(-8)}</span>
                <span className="mx-1 text-[var(--ink-3)]">·</span>
                <span>{s.action}</span>
                {s.reason && (
                  <span className="ml-1 text-[var(--ink-3)]">
                    {s.reason.slice(0, 55)}{s.reason.length > 55 ? "…" : ""}
                  </span>
                )}
                <time className="mt-0.5 block text-[11.5px] text-[var(--ink-3)]">
                  {new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
