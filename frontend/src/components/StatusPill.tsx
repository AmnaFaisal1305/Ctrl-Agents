import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { EmailStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export function StatusPill({ status }: { status: EmailStatus }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Processing
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Pending
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground")}>
      <CheckCircle2 className="h-3.5 w-3.5 text-ok" aria-hidden />
      Done
    </span>
  );
}
