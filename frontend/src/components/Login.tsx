import { useState, type FormEvent } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-surface p-7 shadow-[0_0_0_1px_var(--line),0_2px_8px_rgba(21,18,43,0.06)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-brand shadow-[0_4px_12px_rgba(91,75,255,0.4)]">
            <Inbox className="h-[18px] w-[18px] text-white" aria-hidden />
          </div>
          <span className="font-display text-lg font-semibold text-ink">Helpdesk Triage</span>
        </div>
        <p className="text-sm text-[var(--ink-2)]">Enter the demo password to continue.</p>
        <div className="space-y-1.5">
          <Label htmlFor="pw" className="text-sm font-semibold text-ink">Password</Label>
          <Input
            id="pw"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
          />
        </div>
        {error ? <p role="alert" className="text-sm text-hi">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !password}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-[11px] h-10 text-sm font-semibold text-white transition-all",
            busy || !password
              ? "cursor-not-allowed bg-brand/50"
              : "bg-brand shadow-[0_4px_14px_rgba(91,75,255,0.35)] hover:bg-brand-ink"
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>
      </form>
    </div>
  );
}
