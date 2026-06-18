import { useCallback, useEffect, useState } from "react";
import { isLoggedIn, logout } from "./lib/auth";
import { Login } from "./screens/Login";
import { Projects } from "./screens/Projects";
import { Capture } from "./screens/Capture";
import { Sync } from "./screens/Sync";
import type { TabId } from "./components/TabBar";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("projects");

  const checkAuth = useCallback(async () => {
    setAuthed(await isLoggedIn());
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (authed === null) {
    return (
      <div className="flex min-h-full items-center justify-center bg-cream">
        <p className="text-sm text-warm">Loading…</p>
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  if (tab === "capture") {
    return <Capture onTabChange={setTab} />;
  }
  if (tab === "sync") {
    return <Sync onTabChange={setTab} />;
  }

  return (
    <Projects
      onTabChange={(t) => {
        if (t === "projects") return;
        setTab(t);
      }}
    />
  );
}

// Expose logout for future settings screen
export { logout };
