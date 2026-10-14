import { useEffect, useState } from "react";
import { api } from "./api";
import type { PolicyClause, PolicySection } from "./types";

// Policy rarely changes within a session; fetch once and share the clause lookup across chips.
let cache: PolicySection[] | null = null;
let inflight: Promise<PolicySection[]> | null = null;

function load(): Promise<PolicySection[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) inflight = api.getPolicy().then((s) => (cache = s));
  return inflight;
}

export interface PolicyLookup {
  sections: PolicySection[];
  byCode: Map<string, PolicyClause & { section: string }>;
}

export function usePolicy(): PolicyLookup | null {
  const [sections, setSections] = useState<PolicySection[] | null>(cache);
  useEffect(() => {
    let active = true;
    load().then((s) => active && setSections(s)).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!sections) return null;
  const byCode = new Map<string, PolicyClause & { section: string }>();
  for (const s of sections) for (const c of s.clauses) byCode.set(c.code, { ...c, section: s.section });
  return { sections, byCode };
}
