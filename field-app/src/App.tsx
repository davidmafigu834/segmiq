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
      <div className="flex min-h-full items-center justify-center bg-page font-fw-body">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
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

export { logout };
