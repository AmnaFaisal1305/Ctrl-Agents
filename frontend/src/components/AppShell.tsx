import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Inbox, PenSquare } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { USE_MOCK, api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/cn";

function HealthDot() {
  const { data } = useAsync(() => api.getHealth(), []);
  if (USE_MOCK) {
    return <span className="rounded-md bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Mock data</span>;
  }
  const ok = data?.llm_ready;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={data?.model}>
      <span className={cn("h-2 w-2 rounded-full", data == null ? "bg-muted-foreground" : ok ? "bg-ok" : "bg-warn")} />
      <span className="hidden sm:inline">{data == null ? "connecting…" : ok ? data.model : "LLM not ready"}</span>
    </span>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
  );

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4">
          <NavLink to="/" aria-label="Helpdesk Triage" className="flex items-center gap-2 font-semibold">
            <Inbox className="h-5 w-5 text-primary" aria-hidden />
            <span className="hidden sm:inline">Helpdesk Triage</span>
          </NavLink>
          <nav className="flex items-center gap-1" aria-label="Primary">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/submit" className={navClass}>
              <PenSquare className="h-4 w-4" aria-hidden />
              Submit
            </NavLink>
          </nav>
          <div className="ml-auto">
            <HealthDot />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </TooltipProvider>
  );
}
