import { Bot, CheckCircle2, Search, ShieldCheck, Shield, XCircle, FileText, CircleDot, Eye } from "lucide-react";
import type { Step } from "@/lib/types";
import { cn } from "@/lib/cn";

// model steps (the agent's choices) look different from rule steps (validators, safety net, fallback).
function visuals(step: Step) {
  const rejected = step.action === "validate" && step.reason.startsWith("rejected");
  if (step.decided_by === "rule") {
    if (rejected) return { Icon: XCircle, tint: "text-warn", ring: "border-warn/40 bg-warn-soft" };
    if (step.action === "safety_net") return { Icon: Shield, tint: "text-danger", ring: "border-danger/40 bg-danger-soft" };
    if (step.action === "fallback") return { Icon: ShieldCheck, tint: "text-danger", ring: "border-danger/40 bg-danger-soft" };
    if (step.action === "validate") return { Icon: CheckCircle2, tint: "text-ok", ring: "border-ok/40 bg-ok-soft" };
    return { Icon: FileText, tint: "text-muted-foreground", ring: "border-border bg-muted" };
  }
  if (step.action === "reflect") return { Icon: Eye, tint: "text-primary", ring: "border-primary/30 bg-card" };
  if (step.action === "LookupPolicy") return { Icon: Search, tint: "text-primary", ring: "border-primary/30 bg-card" };
  if (step.action === "Submit") return { Icon: CircleDot, tint: "text-primary", ring: "border-primary/30 bg-card" };
  return { Icon: Bot, tint: "text-primary", ring: "border-primary/30 bg-card" };
}

export function StepItem({ step, last }: { step: Step; last: boolean }) {
  const { Icon, tint, ring } = visuals(step);
  const rejected = step.action === "validate" && step.reason.startsWith("rejected");
  const args = Object.keys(step.args ?? {}).length ? JSON.stringify(step.args) : null;

  return (
    <li className="relative flex gap-3 pb-4 animate-slide-in">
      {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-border" aria-hidden />}
      <span className={cn("z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", ring)}>
        <Icon className={cn("h-4 w-4", tint)} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className={cn("text-xs font-semibold uppercase tracking-wide", step.decided_by === "rule" ? "text-muted-foreground" : "text-primary")}>
            {step.decided_by}
          </span>
          <span className="font-medium">{step.action}</span>
          {args && <span className="font-mono text-xs text-muted-foreground">{args}</span>}
          {typeof step.meta?.input_tokens === "number" && (
            <span className="nums text-xs text-muted-foreground">{step.meta.input_tokens} in / {Number(step.meta.output_tokens ?? 0)} out tokens</span>
          )}
          {step.latency_ms > 0 && <span className="nums ml-auto text-xs text-muted-foreground">{step.latency_ms} ms</span>}
        </div>
        <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-sm", rejected ? "text-warn" : "text-muted-foreground")}>
          {step.reason}
        </p>
      </div>
    </li>
  );
}
