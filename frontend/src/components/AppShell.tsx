import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Activity, Inbox, LayoutDashboard, PenSquare, ShieldCheck } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { USE_MOCK, api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/submit", label: "Submit email", icon: PenSquare },
  { to: "/observability", label: "Observability", icon: Activity },
  { to: "/quality", label: "Quality", icon: ShieldCheck },
] as const;

const ITEM_H = 46; // 42px height + 4px gap between items

function getActiveIdx(pathname: string): number {
  if (pathname === "/" || pathname.startsWith("/emails")) return 0;
  if (pathname.startsWith("/submit")) return 1;
  if (pathname.startsWith("/observability")) return 2;
  if (pathname.startsWith("/quality")) return 3;
  return 0;
}

function AgentStatus() {
  const { data } = useAsync(() => api.getHealth(), []);
  const ok = data?.llm_ready;
  const dotCls = !data
    ? "bg-[#A29EC8]"
    : ok
    ? "bg-[#42E0A0] animate-blink"
    : "bg-warn";

  return (
    <div className="mx-3.5 mb-5 mt-auto rounded-[14px] bg-white/[0.06] p-3.5 text-xs leading-snug">
      <div className="mb-1 flex items-center gap-2 text-[13.5px] font-medium text-white">
        <span className={cn("h-2 w-2 flex-none rounded-full", dotCls)} />
        {USE_MOCK ? "Mock mode" : (data?.model ?? "connecting…")}
      </div>
      <span className="text-[#A29EC8]">
        {USE_MOCK ? "Live data: connect a backend." : "Replies are drafts. Nothing is sent."}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const activeIdx = getActiveIdx(pathname);

  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-1.5 focus:text-white"
      >
        Skip to content
      </a>

      <div className="flex h-screen overflow-hidden">
        {/* ── Desktop sidebar rail ── */}
        <aside className="hidden w-[208px] flex-none flex-col bg-rail md:flex">
          {/* Brand */}
          <div className="flex items-center gap-3 px-5 pb-6 pt-5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-brand shadow-[0_6px_18px_rgba(91,75,255,0.5)]">
              <Inbox className="h-[19px] w-[19px] text-white" aria-hidden />
            </div>
            <div className="font-display text-[17px] font-semibold leading-tight tracking-[-0.01em] text-white">
              Helpdesk<br />Triage
            </div>
          </div>

          {/* Nav with animated pill */}
          <nav className="relative flex flex-col gap-1 px-3.5" aria-label="Main">
            <div
              aria-hidden
              className="absolute inset-x-3.5 h-[42px] rounded-[11px] bg-white/[0.12] transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ transform: `translateY(${activeIdx * ITEM_H}px)` }}
            />
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative z-10 flex h-[42px] items-center gap-[11px] rounded-[11px] px-3 text-[14.5px] font-medium transition-colors",
                    (to === "/" ? pathname === "/" || pathname.startsWith("/emails") : isActive)
                      ? "text-white"
                      : "text-[#A29EC8] hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4 flex-none" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          <AgentStatus />
        </aside>

        {/* ── Mobile top bar ── */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-2 overflow-x-auto bg-rail px-3 py-2 md:hidden">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-brand">
            <Inbox className="h-4 w-4 text-white" aria-hidden />
          </div>
          <nav className="flex items-center gap-0.5" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-sm font-medium transition-colors",
                    (to === "/" ? pathname === "/" || pathname.startsWith("/emails") : isActive)
                      ? "bg-white/[0.12] text-white"
                      : "text-[#A29EC8] hover:text-white"
                  )
                }
              >
                <Icon className="h-3.5 w-3.5 flex-none" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* ── Main content ── */}
        <main id="main" className="flex-1 overflow-y-auto bg-paper px-6 py-5 md:pt-5 max-md:pt-16">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
