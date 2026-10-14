import { Badge } from "@/components/ui/badge";
import { prettyCategory } from "@/lib/format";
import { cn } from "@/lib/cn";

// Sensitive categories are shown calmly; unknown values still render (generic chip).
const SENSITIVE = new Set(["harassment", "wellbeing"]);

export function CategoryChip({ category }: { category: string }) {
  return (
    <Badge
      className={cn(
        "border-border bg-muted capitalize text-foreground",
        SENSITIVE.has(category) && "border-danger/30 text-danger"
      )}
    >
      {prettyCategory(category)}
    </Badge>
  );
}
