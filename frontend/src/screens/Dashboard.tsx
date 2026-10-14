import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Flag, Target } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useEventStream } from "@/lib/sse";
import { PRIORITY_RANK, prettyCategory, relativeTime } from "@/lib/format";
import type { EmailRow, RunState, Stats, Step } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RunBar } from "@/components/RunBar";
import { GmailPanel } from "@/components/GmailPanel";
import { LiveFeed } from "@/components/LiveFeed";
import { PriorityBadge } from "@/components/PriorityBadge";
import { EscalateBadge } from "@/components/EscalateBadge";
import { CategoryChip } from "@/components/CategoryChip";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/cn";

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

// ── Stats strip ────────────────────────────────────────────────────
function StatsStrip({ data }: { data: Stats | null | undefined }) {
  if (!data) return <Skeleton className="h-[74px] w-full rounded-2xl" />;
  const items = [
    {
      label: "Processed",
      value: data.total,
      sub: `of ${data.emails_in_inbox} in inbox`,
      Icon: CheckCircle2,
      chip: "bg-brand-tint text-brand",
    },
    {
      label: "Escalated",
      value: data.escalated,
      sub: "waiting on a person",
      Icon: Flag,
      chip: data.escalated ? "bg-hi-tint text-hi" : "bg-line-2 text-[var(--ink-3)]",
    },
    {
      label: "High priority",
      value: data.by_priority.high ?? 0,
      sub: "across all categories",
      Icon: AlertTriangle,
      chip: "bg-[var(--md-tint)] text-[var(--md)]",
    },
    {
      label: "Avg confidence",
      value: `${Math.round(data.avg_confidence * 100)}%`,
      sub: "processed emails",
      Icon: Target,
      chip: "bg-lo-tint text-lo",
    },
  ];
  return (
    <div className="flex overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(21,18,43,0.04)]">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn("flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5", i > 0 && "border-l border-line")}
        >
          <div className={cn("flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]", it.chip)}>
            <it.Icon className="h-[19px] w-[19px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-[var(--ink-2)]">{it.label}</div>
            <div className="nums font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
              {it.value}
            </div>
            <div className="truncate text-xs text-[var(--ink-3)]">{it.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Breakdown panel ────────────────────────────────────────────────
const PRI_COLORS: Record<string, string> = {
  high: "var(--hi)",
  medium: "var(--md-bar)",
  low: "var(--lo)",
};
const PRI_LABELS = ["High", "Medium", "Low"];

function BreakdownPanel({
  data, catData, priority, setPriority, category, setCategory,
}: {
  data: Stats["by_priority"];
  catData: Stats["by_category"];
  priority: string;
  setPriority: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
}) {
  const cats = Object.entries(catData).sort(([, a], [, b]) => b - a);

  return (
    <div className="grid grid-cols-1 gap-5 rounded-2xl bg-surface px-5 py-4 shadow-[0_0_0_1px_var(--line)] sm:grid-cols-[280px_1fr]">
      {/* Priority bar */}
      <div>
        <div className="mb-2 text-xs font-semibold text-[var(--ink-2)]">Priority</div>
        <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-line-2">
          {["high", "medium", "low"].map((p) => (
            <div
              key={p}
              className="min-w-0 transition-[flex] duration-700"
              style={{ flex: data[p] ?? 0, background: PRI_COLORS[p] }}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-0.5 flex-wrap">
          {PRI_LABELS.map((p) => {
            const key = p.toLowerCase();
            const active = priority === key;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(active ? ANY : key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13.5px] transition-colors",
                  active ? "bg-line-2" : "hover:bg-line-2"
                )}
              >
                <span className="h-2 w-2 rounded-[3px]" style={{ background: PRI_COLORS[key] }} />
                <span className="text-[var(--ink-2)]">{p}</span>
                <span className="nums font-semibold text-ink">{data[key] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category pills */}
      <div>
        <div className="mb-2 text-xs font-semibold text-[var(--ink-2)]">Category</div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map(([cat, n]) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(active ? ANY : cat)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-brand text-white"
                    : "bg-line-2 text-[var(--ink-2)] hover:bg-brand-tint hover:text-brand-ink"
                )}
              >
                {prettyCategory(cat)}
                <span
                  className={cn(
                    "nums min-w-[22px] rounded-full px-1.5 py-px text-center text-[12px] font-semibold",
                    active ? "bg-white/20 text-white" : "bg-surface text-ink"
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────
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

  const sortedCount = rows.filter((r) => r.record).length;
  const escCount = rows.filter((r) => r.record?.escalate).length;
  const lede = stats.data
    ? `${sortedCount} of ${rows.length} emails sorted. ${escCount} ${escCount === 1 ? "is" : "are"} waiting on a person.`
    : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-[-0.025em] text-ink">
            Inbox triage
          </h1>
          {lede && <p className="mt-1 text-sm text-[var(--ink-2)]">{lede}</p>}
        </div>
        <RunBar run={run} onProcessAll={processAll} />
      </div>

      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      {/* 2-col main layout */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_312px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4">
          <StatsStrip data={stats.data} />

          {stats.data && (
            <BreakdownPanel
              data={stats.data.by_priority}
              catData={stats.data.by_category}
              priority={priority}
              setPriority={setPriority}
              category={category}
              setCategory={setCategory}
            />
          )}

          <GmailPanel run={run} onStarted={setRun} />

          {/* Table panel */}
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-3">
              <div className="relative">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search subject or student…"
                  className="h-9 w-52 pl-8 text-sm"
                  aria-label="Search subject or student"
                />
                <svg
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <FilterSelect label="Priority" value={priority} onChange={setPriority} options={["high", "medium", "low"]} />
              <FilterSelect label="Category" value={category} onChange={setCategory} options={categories} render={prettyCategory} />
              <FilterSelect label="Status" value={status} onChange={setStatus} options={["pending", "processing", "done"]} />
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--ink-2)]">
                <Checkbox id="esc-only" checked={escOnly} onCheckedChange={(v) => setEscOnly(v === true)} />
                <Label htmlFor="esc-only" className="cursor-pointer font-normal text-[var(--ink-2)]">Escalated only</Label>
              </label>
              <span className="nums ml-auto text-xs text-[var(--ink-3)]">
                Showing {filtered.length} of {rows.length}
              </span>
            </div>

            {emails.loading ? (
              <Skeleton className="h-64 w-full rounded-none" />
            ) : emails.error ? (
              <ErrorState message={emails.error} onRetry={emails.reload} />
            ) : rows.length === 0 ? (
              <EmptyState title="No emails yet" hint="Submit a student email to see the agent triage it." action />
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-surface text-[12.5px] font-medium text-[var(--ink-3)]">Priority</TableHead>
                      <TableHead className="sticky top-0 hidden bg-surface text-[12.5px] font-medium text-[var(--ink-3)] sm:table-cell">Subject / Student</TableHead>
                      <TableHead className="sticky top-0 hidden bg-surface text-[12.5px] font-medium text-[var(--ink-3)] sm:table-cell">Category</TableHead>
                      <TableHead className="sticky top-0 hidden bg-surface text-[12.5px] font-medium text-[var(--ink-3)] lg:table-cell">Received</TableHead>
                      <TableHead className="sticky top-0 hidden bg-surface text-[12.5px] font-medium text-[var(--ink-3)] sm:table-cell">Confidence</TableHead>
                      <TableHead className="sticky top-0 bg-surface text-[12.5px] font-medium text-[var(--ink-3)]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const priColor = r.record?.priority === "high"
                        ? "var(--hi)"
                        : r.record?.priority === "medium"
                        ? "var(--md-bar)"
                        : "var(--lo)";
                      return (
                        <TableRow
                          key={r.id}
                          tabIndex={0}
                          role="link"
                          className="cursor-pointer transition-colors hover:bg-line-2/50"
                          style={r.record ? { boxShadow: `inset 3px 0 0 ${priColor}` } : undefined}
                          onClick={() => navigate(`/emails/${r.id}`)}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/emails/${r.id}`); }}
                        >
                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              {r.record ? <PriorityBadge priority={r.record.priority} /> : <span className="text-xs text-[var(--ink-3)]">—</span>}
                              {r.record?.escalate && <EscalateBadge />}
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[18rem] sm:table-cell">
                            <div className="truncate font-medium text-ink">{r.subject || "(no subject)"}</div>
                            <div className="text-xs text-[var(--ink-2)]">{r.from_name || "—"}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {r.record ? <CategoryChip category={r.record.category} /> : null}
                          </TableCell>
                          <TableCell className="nums hidden whitespace-nowrap text-sm text-[var(--ink-3)] lg:table-cell">
                            {relativeTime(r.received_at)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {r.record ? <ConfidenceMeter value={r.record.confidence} /> : null}
                          </TableCell>
                          <TableCell><StatusPill status={r.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-[var(--ink-3)]">
                          No emails match these filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live feed */}
        <aside className="flex flex-col overflow-hidden rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] xl:sticky xl:top-5 xl:h-[calc(100vh-5rem)]">
          <LiveFeed steps={feed} />
        </aside>
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
      <SelectTrigger className="h-9 w-[9rem] text-sm" aria-label={label}>
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
