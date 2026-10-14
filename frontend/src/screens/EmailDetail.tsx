import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Info } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useEventStream } from "@/lib/sse";
import { absoluteTime } from "@/lib/format";
import type { Step } from "@/lib/types";
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
import { cn } from "@/lib/cn";

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]", className)}>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function EmailDetail() {
  const { id = "" } = useParams();
  const detail = useAsync(() => api.getEmail(id), [id]);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => { if (detail.data) setSteps(detail.data.steps); }, [detail.data]);

  useEventStream({
    onStep: (s) => {
      if (s.email_id !== id) return;
      setSteps((prev) => [...prev, s]);
      if (s.action === "validate" || s.action === "fallback") setTimeout(() => detail.reload(), 300);
    },
  });

  if (detail.loading && !detail.data) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (detail.error && !detail.data) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return null;

  const d = detail.data;
  const rec = d.record;

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-line-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Queue
        </Link>
        {d.status === "processing" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-brand">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processing
          </span>
        )}
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-line-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          disabled={d.status === "processing"}
          onClick={() => { setSteps([]); api.reprocess(id).catch(() => {}); detail.reload(); }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reprocess
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: the email (untrusted → plain text only) */}
        <Panel>
          <div className="space-y-3">
            <div>
              <h1 className="font-display text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink">
                {d.subject || "(no subject)"}
              </h1>
              <p className="mt-1 text-sm text-[var(--ink-2)]">
                {d.from_name || "Unknown"}{" "}
                <span className="font-mono text-xs text-[var(--ink-3)]">&lt;{d.from_email || "—"}&gt;</span>
              </p>
              <p className="nums text-xs text-[var(--ink-3)]">{absoluteTime(d.received_at)}</p>
            </div>

            {d.load_warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-[10px] bg-line-2 px-3 py-2 text-xs text-[var(--ink-2)]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{d.load_warnings.join("; ")}</span>
              </div>
            )}

            <div className="max-h-[28rem] overflow-y-auto rounded-[10px] border border-line bg-paper p-3.5">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{d.body || "(empty body)"}</p>
            </div>
          </div>
        </Panel>

        {/* Right: the decision */}
        <Panel>
          <div className="space-y-4">
            {!rec ? (
              <p className="text-sm text-[var(--ink-2)]">
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
                    <span className="text-xs text-[var(--ink-3)]">Policy:</span>
                    {rec.policy_refs.map((c) => <PolicyRefChip key={c} code={c} />)}
                  </div>
                )}

                <ReplyDraft text={rec.reply_draft} />

                {rec.agent_notes && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[var(--ink-3)]">Agent notes</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-[var(--ink-2)]">{rec.agent_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>

      {(steps.some((s) => s.action === "context") || steps.some((s) => s.action.startsWith("reflect"))) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="min-w-0"><ContextCard steps={steps} /></Panel>
          <Panel className="min-w-0"><ReflectionCard steps={steps} /></Panel>
        </div>
      )}

      <Panel>
        <StepTimeline steps={steps} status={d.status} />
      </Panel>
    </div>
  );
}
