import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePolicy } from "@/lib/usePolicy";
import { cn } from "@/lib/cn";

// Policy code chip; click opens the clause text from GET /api/policy.
// ESC codes drive escalation and may not appear in the Fees/Hostel/etc. sections.
export function PolicyRefChip({ code }: { code: string }) {
  const policy = usePolicy();
  const clause = policy?.byCode.get(code);
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {code}
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-1 font-mono text-xs font-semibold">
          {code}
          {clause ? <span className="ml-2 font-sans font-normal text-muted-foreground">{clause.section}</span> : null}
        </p>
        <p className="text-sm leading-relaxed">
          {clause ? clause.text : "Clause text not found in the policy sections."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
