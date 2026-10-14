import { Flag } from "lucide-react";
import { cn } from "@/lib/cn";

export function EscalateBadge({ reason, className }: { reason?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-hi-tint px-2 py-0.5 text-xs font-semibold text-hi",
        className
      )}
    >
      <Flag className="h-3 w-3 flex-none" aria-hidden />
      Escalated
      {reason ? <span className="font-normal opacity-70">· {reason}</span> : null}
    </span>
  );
}
