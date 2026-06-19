import { useCallback, useEffect, useState } from "react";
import { AUTH_EXPIRED_EVENT } from "./lib/api";
import { isLoggedIn, logout } from "./lib/auth";
import { Login } from "./screens/Login";
import { Projects } from "./screens/Projects";
import { Capture } from "./screens/Capture";
import { Sync } from "./screens/Sync";
import { Account } from "./screens/Account";
import { ProjectDetail } from "./screens/ProjectDetail";
import type { TabId } from "./components/TabBar";
import type { Project } from "./components/ProjectCard";

type View =
  | { kind: "tab"; tab: TabId }
  | { kind: "project"; project: Project }
  | { kind: "account" };

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ kind: "tab", tab: "projects" });
  const [captureProjectId, setCaptureProjectId] = useState<string | null>(null);
  const [authExpiredMsg, setAuthExpiredMsg] = useState("");

  const checkAuth = useCallback(async () => {
    setAuthed(await isLoggedIn());
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handler = () => {
      setAuthExpiredMsg("Your session expired. Please sign in again.");
      void logout().then(() => {
        setView({ kind: "tab", tab: "projects" });
        setAuthed(false);
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  function handleLoggedOut() {
    setView({ kind: "tab", tab: "projects" });
    setAuthed(false);
  }

  function openCapture(projectId?: string) {
    setCaptureProjectId(projectId ?? null);
    setView({ kind: "tab", tab: "capture" });
  }

  if (authed === null) {
    return (
      <div className="flex min-h-full items-center justify-center bg-page font-fw-body">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
      </div>
    );
  }

  if (!authed) {
    return (
      <Login
        expiredMessage={authExpiredMsg}
        onSuccess={() => {
          setAuthExpiredMsg("");
          setAuthed(true);
        }}
      />
    );
  }

  if (view.kind === "account") {
    return (
      <Account
        onClose={() => setView({ kind: "tab", tab: "projects" })}
        onLoggedOut={handleLoggedOut}
      />
    );
  }

  if (view.kind === "project") {
    return (
      <ProjectDetail
        project={view.project}
        onBack={() => setView({ kind: "tab", tab: "projects" })}
        onCapture={(projectId) => openCapture(projectId)}
        onOpenAccount={() => setView({ kind: "account" })}
      />
    );
  }

  const openAccount = () => setView({ kind: "account" });
  const onTabChange = (tab: TabId) => {
    if (tab === "projects") {
      setView({ kind: "tab", tab: "projects" });
      return;
    }
    setCaptureProjectId(null);
    setView({ kind: "tab", tab });
  };

  if (view.tab === "capture") {
    return (
      <Capture
        onTabChange={onTabChange}
        onOpenAccount={openAccount}
        initialProjectId={captureProjectId}
      />
    );
  }

  if (view.tab === "sync") {
    return <Sync onTabChange={onTabChange} onOpenAccount={openAccount} />;
  }

  return (
    <Projects
      onTabChange={onTabChange}
      onOpenAccount={openAccount}
      onOpenProject={(project) => setView({ kind: "project", project })}
      onAuthExpired={() => {
        setAuthExpiredMsg("Your session expired. Please sign in again.");
        void logout().then(() => setAuthed(false));
      }}
    />
  );
}

export { logout };
