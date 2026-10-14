import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wordCount } from "@/lib/format";
import { cn } from "@/lib/cn";

// A draft only. There is no Send anywhere in this product; Copy is the one outward action.
// Rendered as plain text (never dangerouslySetInnerHTML) since email-derived text is untrusted.
export function ReplyDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const words = wordCount(text);
  const over = words >= 150;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Reply draft</span>
        <div className="flex items-center gap-3">
          <span className={cn("nums text-xs", over ? "text-danger" : "text-muted-foreground")}>
            {words} / 150
          </span>
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words p-3 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
