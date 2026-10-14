import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/cn";

// Color always paired with an icon + label (never color alone).
const MAP: Record<Priority, { label: string; cls: string; Icon: typeof ArrowUp }> = {
  high: { label: "High", cls: "border-danger/30 bg-danger-soft text-danger", Icon: ArrowUp },
  medium: { label: "Medium", cls: "border-warn/30 bg-warn-soft text-warn", Icon: ArrowRight },
  low: { label: "Low", cls: "border-border bg-muted text-muted-foreground", Icon: ArrowDown },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, cls, Icon } = MAP[priority] ?? MAP.low;
  return (
    <Badge className={cn(cls)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
