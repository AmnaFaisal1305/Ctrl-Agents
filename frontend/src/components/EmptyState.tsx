import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

// Calm empty state (no emoji/playful copy — this tool handles sensitive content).
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? (
        <Button asChild className="mt-4">
          <Link to="/submit">Submit an email</Link>
        </Button>
      ) : null}
    </div>
  );
}
