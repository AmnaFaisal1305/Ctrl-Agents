import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EXAMPLES } from "./examples";
import { cn } from "@/lib/cn";

export default function Submit() {
  const navigate = useNavigate();
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [processNow, setProcessNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function prefill(key: string) {
    const ex = EXAMPLES.find((e) => e.key === key)!;
    setFromName(ex.from_name);
    setFromEmail(ex.from_email);
    setSubject(ex.subject);
    setBody(ex.body);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() && !body.trim()) {
      setError("Enter a subject or a body.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createEmail({ from_name: fromName, from_email: fromEmail, subject, body, process: processNow });
      navigate(`/emails/${res.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the email.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-none tracking-[-0.025em] text-ink">
          Submit an email
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Paste a student email and watch the agent triage it. Replies are drafts — nothing is ever sent.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Form panel */}
        <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]">
          {/* Examples */}
          <div className="border-b border-line px-5 py-3.5">
            <p className="mb-2.5 text-xs font-semibold text-[var(--ink-3)]">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.key}
                  type="button"
                  onClick={() => prefill(ex.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-line-2 px-3 py-1 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:border-brand/40 hover:bg-brand-tint hover:text-brand-ink"
                >
                  <Sparkles className="h-3 w-3 flex-none opacity-60" aria-hidden />
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <form className="space-y-4 p-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="from-name" className="text-sm font-semibold text-ink">From name</Label>
                <Input id="from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Hamza Qureshi" className="h-[42px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="from-email" className="text-sm font-semibold text-ink">From email</Label>
                <Input id="from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hamza.q@example.com" className="h-[42px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-sm font-semibold text-ink">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Late fee waiver request" className="h-[42px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body" className="text-sm font-semibold text-ink">Body</Label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Paste the student's message…" />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink-2)]">
              <Checkbox id="process-now" checked={processNow} onCheckedChange={(v) => setProcessNow(v === true)} />
              <Label htmlFor="process-now" className="cursor-pointer font-normal text-[var(--ink-2)]">
                Triage immediately after adding
              </Label>
            </label>

            {error && <p role="alert" className="text-sm text-hi">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "inline-flex items-center gap-2 rounded-[11px] px-5 h-10 text-sm font-semibold text-white transition-all active:scale-[0.97]",
                submitting
                  ? "cursor-not-allowed bg-brand/50"
                  : "bg-brand shadow-[0_4px_14px_rgba(91,75,255,0.35)] hover:bg-brand-ink hover:shadow-[0_6px_20px_rgba(91,75,255,0.45)]"
              )}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" /> : <Send className="h-3.5 w-3.5 flex-none" />}
              {submitting ? "Submitting…" : processNow ? "Add and triage" : "Add to inbox"}
            </button>
          </form>
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
          <h2 className="font-display text-[15px] font-semibold text-ink">How it works</h2>
          <ol className="space-y-4">
            {[
              { step: "1", title: "Agent reads the email", body: "Looks up university policy and classifies the issue into a category and priority." },
              { step: "2", title: "Confidence check", body: "A critic reviews the decision. If confidence is low, the email is escalated for a human." },
              { step: "3", title: "Draft reply", body: "A policy-grounded reply under 150 words is drafted — never sent without human sign-off." },
            ].map((it) => (
              <li key={it.step} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-tint text-[11px] font-bold text-brand">
                  {it.step}
                </span>
                <div>
                  <div className="font-semibold text-ink">{it.title}</div>
                  <div className="mt-0.5 text-[var(--ink-2)]">{it.body}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-auto rounded-[11px] bg-lo-tint px-3.5 py-3 text-xs text-lo">
            Replies are always drafts. Nothing is sent to the student.
          </div>
        </div>
      </div>
    </div>
  );
}
