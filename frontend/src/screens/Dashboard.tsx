import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useEventStream } from "@/lib/sse";
import { PRIORITY_RANK, prettyCategory, relativeTime } from "@/lib/format";
import type { EmailRow, RunState, Step } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { BreakdownBars } from "@/components/BreakdownBars";
import { RunBar } from "@/components/RunBar";
import { LiveFeed } from "@/components/LiveFeed";
import { PriorityBadge } from "@/components/PriorityBadge";
import { EscalateBadge } from "@/components/EscalateBadge";
import { CategoryChip } from "@/components/CategoryChip";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

const ANY = "__any__";

function sortRows(rows: EmailRow[]): EmailRow[] {
  return [...rows].sort((a, b) => {
    const ea = a.record?.escalate ? 0 : 1;
    const eb = b.record?.escalate ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const pa = a.record ? PRIORITY_RANK[a.record.priority] ?? 3 : 4;
    const pb = b.record ? PRIORITY_RANK[b.record.priority] ?? 3 : 4;
    if (pa !== pb) return pa - pb;
    return (b.received_at || "").localeCompare(a.received_at || "");
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const stats = useAsync(() => api.getStats(), []);
  const emails = useAsync(() => api.getEmails(), []);
  const [run, setRun] = useState<RunState | null>(null);
  const [feed, setFeed] = useState<Step[]>([]);

  useEffect(() => { api.getRun().then(setRun).catch(() => {}); }, []);

  useEventStream({
    onStep: (s) => {
      setFeed((prev) => [s, ...prev].slice(0, 40));
      if (s.action === "validate" || s.action === "fallback") {
        emails.reload();
        stats.reload();
      }
    },
    onRun: (r) => {
      setRun(r);
      if (!r.running) { emails.reload(); stats.reload(); }
    },
  });

  // filters
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState(ANY);
  const [category, setCategory] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [escOnly, setEscOnly] = useState(false);

  const rows = emails.data ?? [];
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.record?.category).filter(Boolean) as string[])].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortRows(
      rows.filter((r) => {
        if (priority !== ANY && r.record?.priority !== priority) return false;
        if (category !== ANY && r.record?.category !== category) return false;
        if (status !== ANY && r.status !== status) return false;
        if (escOnly && !r.record?.escalate) return false;
        if (needle && !(`${r.subject} ${r.from_name}`.toLowerCase().includes(needle))) return false;
        return true;
      })
    );
  }, [rows, q, priority, category, status, escOnly]);

  function processAll(onlyNew: boolean) {
    setFeed([]);
    api.process({ only_new: onlyNew }).then(setRun).catch(() => {});
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats.error ? (
        <ErrorState message={stats.error} onRetry={stats.reload} />
      ) : stats.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Processed" value={stats.data.total} hint={`${stats.data.emails_in_inbox} in inbox`} />
          <StatCard label="Escalated" value={stats.data.escalated} tone={stats.data.escalated ? "danger" : "default"} />
          <StatCard label="High priority" value={stats.data.by_priority.high ?? 0} tone="warn" />
          <StatCard label="Needs a human" value={stats.data.needs_human_fallback} tone={stats.data.needs_human_fallback ? "danger" : "default"} />
          <StatCard label="Avg confidence" value={`${Math.round(stats.data.avg_confidence * 100)}%`} />
        </div>
      ) : null}

      {/* Breakdowns + run bar */}
      <div className="grid gap-4 lg:grid-cols-3">
        {stats.data && (
          <Card className="lg:col-span-2">
            <CardContent className="grid gap-6 pt-4 sm:grid-cols-2">
              <BreakdownBars title="By category" data={stats.data.by_category} />
              <BreakdownBars
                title="By priority"
                data={stats.data.by_priority}
                order={["high", "medium", "low"]}
                tone={(k) => (k === "high" ? "bg-danger" : k === "medium" ? "bg-warn" : "bg-ok")}
              />
            </CardContent>
          </Card>
        )}
        <div className="space-y-4">
          <RunBar run={run} onProcessAll={processAll} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Queue */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject or student…"
              className="h-8 w-56"
              aria-label="Search subject or student"
            />
            <FilterSelect label="Priority" value={priority} onChange={setPriority} options={["high", "medium", "low"]} />
            <FilterSelect label="Category" value={category} onChange={setCategory} options={categories} render={prettyCategory} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={["pending", "processing", "done"]} />
            <div className="flex items-center gap-1.5">
              <Checkbox id="esc-only" checked={escOnly} onCheckedChange={(v) => setEscOnly(v === true)} />
              <Label htmlFor="esc-only" className="cursor-pointer text-sm font-normal text-muted-foreground">
                Escalated only
              </Label>
            </div>
          </div>

          {emails.loading ? (
            <Skeleton className="h-64 w-full" />
          ) : emails.error ? (
            <ErrorState message={emails.error} onRetry={emails.reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="No emails yet" hint="Submit a student email to see the agent triage it." action />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="hidden md:table-cell">Student</TableHead>
                    <TableHead className="hidden lg:table-cell">Received</TableHead>
                    <TableHead className="hidden sm:table-cell">Confidence</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer"
                      onClick={() => navigate(`/emails/${r.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/emails/${r.id}`); }}
                    >
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {r.record ? <PriorityBadge priority={r.record.priority} /> : <span className="text-xs text-muted-foreground">—</span>}
                          {r.record?.escalate && <EscalateBadge />}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {r.record ? <CategoryChip category={r.record.category} /> : null}
                      </TableCell>
                      <TableCell className="max-w-[18rem]">
                        <span className="line-clamp-2 font-medium">{r.subject || "(no subject)"}</span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                        {r.from_name || "—"}
                      </TableCell>
                      <TableCell className="nums hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                        {relativeTime(r.received_at)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {r.record ? <ConfidenceMeter value={r.record.confidence} /> : null}
                      </TableCell>
                      <TableCell><StatusPill status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No emails match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {/* Live feed */}
        <Card className="lg:col-span-1">
          <CardContent className="h-full pt-4">
            <LiveFeed steps={feed} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[8.5rem]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{label}: any</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {render ? render(o) : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
