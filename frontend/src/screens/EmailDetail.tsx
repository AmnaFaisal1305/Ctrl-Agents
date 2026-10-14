import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Info } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useEventStream } from "@/lib/sse";
import { absoluteTime } from "@/lib/format";
import type { Step } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/PriorityBadge";
import { EscalateBadge } from "@/components/EscalateBadge";
import { CategoryChip } from "@/components/CategoryChip";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { PolicyRefChip } from "@/components/PolicyRefChip";
import { ReplyDraft } from "@/components/ReplyDraft";
import { StepTimeline } from "@/components/StepTimeline";
import { ContextCard } from "@/components/ContextCard";
import { ReflectionCard } from "@/components/ReflectionCard";
import { ErrorState } from "@/components/ErrorState";

export default function EmailDetail() {
  const { id = "" } = useParams();
  const detail = useAsync(() => api.getEmail(id), [id]);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => { if (detail.data) setSteps(detail.data.steps); }, [detail.data]);

  useEventStream({
    onStep: (s) => {
      if (s.email_id !== id) return;
      setSteps((prev) => [...prev, s]);
      // final step saved -> refetch to pick up the saved record
      if (s.action === "validate" || s.action === "fallback") setTimeout(() => detail.reload(), 300);
    },
  });

  if (detail.loading && !detail.data) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (detail.error && !detail.data) {
    return <ErrorState message={detail.error} onRetry={detail.reload} />;
  }
  if (!detail.data) return null;

  const d = detail.data;
  const rec = d.record;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Queue</Link>
        </Button>
        {d.status === "processing" && (
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processing
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={d.status === "processing"}
          onClick={() => { setSteps([]); api.reprocess(id).catch(() => {}); detail.reload(); }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reprocess
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: the email (untrusted -> plain text) */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <h1 className="text-lg font-semibold leading-snug">{d.subject || "(no subject)"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {d.from_name || "Unknown"}{" "}
                <span className="font-mono text-xs">&lt;{d.from_email || "—"}&gt;</span>
              </p>
              <p className="nums text-xs text-muted-foreground">{absoluteTime(d.received_at)}</p>
            </div>

            {d.load_warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{d.load_warnings.join("; ")}</span>
              </div>
            )}

            <div className="max-h-[28rem] overflow-y-auto rounded-md border bg-background p-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{d.body || "(empty body)"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Right: the decision */}
        <Card>
          <CardContent className="space-y-4 pt-4">
            {!rec ? (
              <p className="text-sm text-muted-foreground">
                {d.status === "processing" ? "The agent is working on this email…" : "No decision yet."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryChip category={rec.category} />
                  <PriorityBadge priority={rec.priority} />
                  <ConfidenceMeter value={rec.confidence} />
                </div>

                {rec.escalate && <EscalateBadge reason={rec.escalation_reason} />}

                {rec.policy_refs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Policy:</span>
                    {rec.policy_refs.map((c) => <PolicyRefChip key={c} code={c} />)}
                  </div>
                )}

                <ReplyDraft text={rec.reply_draft} />

                {rec.agent_notes && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Agent notes</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{rec.agent_notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {(steps.some((s) => s.action === "context") || steps.some((s) => s.action.startsWith("reflect"))) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="min-w-0"><CardContent className="pt-4"><ContextCard steps={steps} /></CardContent></Card>
          <Card className="min-w-0"><CardContent className="pt-4"><ReflectionCard steps={steps} /></CardContent></Card>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="pt-4">
          <StepTimeline steps={steps} status={d.status} />
        </CardContent>
      </Card>
    </div>
  );
}
