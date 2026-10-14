import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export function StatCard({
  label, value, hint, tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "danger" | "warn" | "default";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "nums mt-1 text-2xl font-semibold",
          tone === "danger" && "text-danger",
          tone === "warn" && "text-warn"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
