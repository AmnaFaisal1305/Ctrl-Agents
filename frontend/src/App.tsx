import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/screens/Dashboard";
import EmailDetail from "@/screens/EmailDetail";
import Submit from "@/screens/Submit";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/emails/:id" element={<EmailDetail />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="*" element={<p className="text-muted-foreground">Page not found.</p>} />
      </Routes>
    </AppShell>
  );
}
