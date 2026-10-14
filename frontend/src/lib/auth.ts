// Demo login token. Kept in sessionStorage (per tab) and fully optional: the backend only asks for
// a login when DEMO_PASSWORD is set. The password itself is never stored; only the signed token.
const KEY = "helpdesk-auth";

export function getToken(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the login screen simply reappears on reload */
  }
}

export const AUTH_REQUIRED_EVENT = "helpdesk:auth-required";
