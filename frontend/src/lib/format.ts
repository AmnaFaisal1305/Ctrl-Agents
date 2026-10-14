// Word count matching the backend's <150 rule closely enough for a live counter.
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || "—";
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (Math.abs(min) < 1) return "just now";
  if (Math.abs(min) < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function prettyCategory(c: string): string {
  return c.replace(/_/g, " ");
}
