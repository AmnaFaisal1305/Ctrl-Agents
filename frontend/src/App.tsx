import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { api, USE_MOCK } from "@/lib/api";
import { AUTH_REQUIRED_EVENT, getToken } from "@/lib/auth";
import { Login } from "@/components/Login";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/screens/Dashboard";
import EmailDetail from "@/screens/EmailDetail";
import Submit from "@/screens/Submit";
import Observability from "@/screens/Observability";
import Quality from "@/screens/Quality";

export default function App() {
  // The backend only asks for a login when DEMO_PASSWORD is set (the public demo). Otherwise nothing changes.
  const [needLogin, setNeedLogin] = useState(false);
  useEffect(() => {
    if (USE_MOCK) return;
    const show = () => setNeedLogin(true);
    window.addEventListener(AUTH_REQUIRED_EVENT, show);
    api.getHealth().then((h) => { if (h.auth_required && !getToken()) show(); }).catch(() => {});
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, show);
  }, []);
  if (needLogin) return <Login onDone={() => window.location.reload()} />;
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/emails/:id" element={<EmailDetail />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/observability" element={<Observability />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="*" element={<p className="text-muted-foreground">Page not found.</p>} />
      </Routes>
    </AppShell>
  );
}
