import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// The office/reason comes from escalation_reason, e.g. "ESC-1: electrical hazard; Hostel Warden and Security".
export function EscalateBadge({ reason, className }: { reason?: string; className?: string }) {
  return (
    <Badge className={cn("border-danger/40 bg-danger text-danger-foreground", className)}>
      <ShieldAlert className="h-3 w-3" aria-hidden />
      Escalated
      {reason ? <span className="font-normal opacity-90">· {reason}</span> : null}
    </Badge>
  );
}
