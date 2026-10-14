import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { EmailStatus } from "@/lib/types";

export function StatusPill({ status }: { status: EmailStatus }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Processing
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-lo">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      Done
    </span>
  );
}
