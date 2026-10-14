import { useState, type FormEvent } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 font-semibold">
          <Inbox className="h-5 w-5 text-primary" aria-hidden />
          Helpdesk Triage
        </div>
        <p className="text-sm text-muted-foreground">Enter the demo password to continue.</p>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy || !password}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>
    </div>
  );
}
