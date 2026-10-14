// Shared live-event stream. One EventSource for the whole app (or the mock bus under
// VITE_USE_MOCK); components subscribe via useEventStream. Falls back to polling /api/run
// every 2s if the stream errors (Design.md section 7).
import { useEffect, useRef } from "react";
import { API_BASE, USE_MOCK, api } from "./api";
import { subscribeMock } from "./mock";
import type { RunState, Step } from "./types";

type StepCb = (s: Step) => void;
type RunCb = (r: RunState) => void;

const stepSubs = new Set<StepCb>();
const runSubs = new Set<RunCb>();

let es: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let mockUnsub: (() => void) | null = null;

function fanStep(s: Step) { stepSubs.forEach((f) => f(s)); }
function fanRun(r: RunState) { runSubs.forEach((f) => f(r)); }

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => { api.getRun().then(fanRun).catch(() => {}); }, 2000);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function ensureOpen() {
  if (USE_MOCK) {
    if (!mockUnsub) {
      mockUnsub = subscribeMock((e) => (e.type === "step" ? fanStep(e.data) : fanRun(e.data)));
    }
    return;
  }
  if (es) return;
  es = new EventSource(`${API_BASE}/api/events`);
  es.addEventListener("step", (e) => fanStep(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("run", (e) => fanRun(JSON.parse((e as MessageEvent).data)));
  es.onopen = stopPolling; // stream healthy -> drop the fallback
  es.onerror = startPolling; // EventSource auto-reconnects; poll meanwhile
}

function maybeClose() {
  if (stepSubs.size || runSubs.size) return;
  es?.close();
  es = null;
  stopPolling();
  mockUnsub?.();
  mockUnsub = null;
}

export function useEventStream(handlers: { onStep?: StepCb; onRun?: RunCb }) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onStep: StepCb = (s) => ref.current.onStep?.(s);
    const onRun: RunCb = (r) => ref.current.onRun?.(r);
    stepSubs.add(onStep);
    runSubs.add(onRun);
    ensureOpen();
    return () => {
      stepSubs.delete(onStep);
      runSubs.delete(onRun);
      maybeClose();
    };
  }, []);
}
