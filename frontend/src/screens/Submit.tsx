import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EXAMPLES } from "./examples";

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
      const res = await api.createEmail({
        from_name: fromName,
        from_email: fromEmail,
        subject,
        body,
        process: processNow,
      });
      navigate(`/emails/${res.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the email.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Submit an email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a student email and watch the agent triage it. Nothing is ever sent — replies are drafts for a human.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <Button key={ex.key} type="button" variant="outline" size="sm" onClick={() => prefill(ex.key)}>
              {ex.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="from-name">From name</Label>
                <Input id="from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Hamza Qureshi" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="from-email">From email</Label>
                <Input id="from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hamza.q@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Late fee waiver request" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Paste the student's message…" />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="process-now" checked={processNow} onCheckedChange={(v) => setProcessNow(v === true)} />
              <Label htmlFor="process-now" className="cursor-pointer font-normal text-muted-foreground">
                Process now
              </Label>
            </div>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
