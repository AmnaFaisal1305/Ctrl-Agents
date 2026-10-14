// Single seam between the UI and the backend. With VITE_USE_MOCK=1 every call resolves
// from lib/mock.ts instead of the network, so the UI runs with no backend (Design.md section 8).
import { ApiError, mock } from "./mock";
import { AUTH_REQUIRED_EVENT, getToken, setToken } from "./auth";
import type {
  CreateEmailBody, EmailDetail, EmailRow, EvalsResponse, Harness, Health, Metrics, PolicySection, RunState, Stats,
} from "./types";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export { ApiError };

async function json<T>(path: string, init?: RequestInit, extra?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(getToken() ? { "X-Auth": getToken() } : {}),
        ...(extra ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the backend. Is it running on " + API_BASE + "?");
  }
  if (res.status === 401 && path !== "/api/login") {
    setToken(""); // expired or wrong token: show the login screen again
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = (data.detail ?? data.message ?? msg) as string;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  getHealth: (): Promise<Health> => (USE_MOCK ? mock.getHealth() : json("/api/health")),
  getStats: (): Promise<Stats> => (USE_MOCK ? mock.getStats() : json("/api/stats")),
  getEmails: (): Promise<EmailRow[]> => (USE_MOCK ? mock.getEmails() : json("/api/emails")),
  getEmail: (id: string): Promise<EmailDetail> =>
    USE_MOCK ? mock.getEmail(id) : json(`/api/emails/${encodeURIComponent(id)}`),
  getPolicy: (): Promise<PolicySection[]> => (USE_MOCK ? mock.getPolicy() : json("/api/policy")),
  getMetrics: (): Promise<Metrics> => (USE_MOCK ? mock.getMetrics() : json("/api/metrics")),
  getHarness: (): Promise<Harness> => (USE_MOCK ? mock.getHarness() : json("/api/harness")),
  getEvals: (): Promise<EvalsResponse> => (USE_MOCK ? mock.getEvals() : json("/api/evals")),
  getRun: (): Promise<RunState> => (USE_MOCK ? mock.getRun() : json("/api/run")),

  login: async (password: string): Promise<void> => {
    const r = await json<{ token: string }>("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    setToken(r.token);
  },

  // Fetch the Gmail label, process it, optionally save reply DRAFTS (nothing is ever sent).
  gmailFetch: (createDrafts: boolean, adminKey: string): Promise<RunState> =>
    USE_MOCK
      ? Promise.reject(new ApiError(0, "Gmail is not available in mock mode."))
      : json("/api/gmail/fetch", { method: "POST", body: JSON.stringify({ create_drafts: createDrafts }) },
          adminKey ? { "X-Admin-Key": adminKey } : undefined),

  createEmail: (body: CreateEmailBody): Promise<{ id: string; processing: boolean; run: RunState }> =>
    USE_MOCK
      ? mock.createEmail(body)
      : json("/api/emails", { method: "POST", body: JSON.stringify(body) }),

  reprocess: (id: string): Promise<RunState> =>
    USE_MOCK
      ? mock.reprocess(id)
      : json(`/api/emails/${encodeURIComponent(id)}/reprocess`, { method: "POST" }),

  process: (opts: { only_new?: boolean; ids?: string[] | null }): Promise<RunState> =>
    USE_MOCK
      ? mock.process(opts.ids ?? null)
      : json("/api/process", {
          method: "POST",
          body: JSON.stringify({ only_new: opts.only_new ?? false, ids: opts.ids ?? null }),
        }),
};
