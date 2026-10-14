import { useState } from "react";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RunState } from "@/lib/types";

// Fetch the Gmail label, run the agent on it, and (optionally) save the replies as Gmail DRAFTS.
// Nothing is ever sent. The admin key is typed here and kept only in memory, never in the bundle.
export function GmailPanel({ run, onStarted }: { run: RunState | null; onStarted: (r: RunState) => void }) {
  const [adminKey, setAdminKey] = useState("");
  const [drafts, setDrafts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = busy || (run?.running ?? false);

  async function fetchMail() {
    setBusy(true);
    setError("");
    try {
      onStarted(await api.gmailFetch(drafts, adminKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gmail fetch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3">
      <Button variant="outline" onClick={fetchMail} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Fetch from Gmail
      </Button>
      <div className="flex items-center gap-2">
        <Checkbox id="gmail-drafts" checked={drafts} onCheckedChange={(v) => setDrafts(v === true)} disabled={running} />
        <Label htmlFor="gmail-drafts" className="cursor-pointer text-sm font-normal text-muted-foreground">
          Save replies as Gmail drafts (never sent)
        </Label>
      </div>
      <Input
        type="password"
        aria-label="Admin key"
        placeholder="Admin key"
        autoComplete="off"
        className="h-9 w-40"
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
      />
      {error ? (
        <span role="alert" className="inline-flex items-center gap-1 text-sm text-danger">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {error}
        </span>
      ) : null}
    </div>
  );
}
