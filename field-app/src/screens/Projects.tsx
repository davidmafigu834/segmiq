import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { getClientId, getUserName } from "../lib/auth";
import { ProjectCard, type Project } from "../components/ProjectCard";
import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";

type Props = {
  onTabChange: (tab: TabId) => void;
};

export function Projects({ onTabChange }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    const clientId = await getClientId();
    if (!clientId) {
      setError("Missing client ID. Please sign in again.");
      setLoading(false);
      return;
    }

    const res = await apiGet<Project[] | { error?: string }>(
      `/api/clients/${clientId}/projects`
    );

    if (!res.ok) {
      setError((res.data as { error?: string }).error ?? "Failed to load projects.");
      setLoading(false);
      return;
    }

    if (Array.isArray(res.data)) {
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setProjects(sorted);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void getUserName().then((n) => setUserName(n ?? ""));
    void fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="flex min-h-full flex-col bg-cream">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-cream px-5 py-4">
        <div>
          <p className="font-display text-[22px] text-ink">Projects</p>
          {userName && (
            <p className="text-[12px] text-warm">Hi, {userName.split(" ")[0]}</p>
          )}
        </div>
        <button
          type="button"
          className="rounded-xl bg-ink px-4 py-2 text-[12px] font-bold text-lime"
          onClick={() => {
            /* New project — Prompt 3 */
          }}
        >
          + New
        </button>
      </header>

      <main
        className="flex-1 px-5 py-4"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        {loading && (
          <p className="text-center text-sm text-warm py-8">Loading projects…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              type="button"
              className="mt-2 block text-xs font-semibold underline"
              onClick={() => void fetchProjects()}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && projects.length === 0 && (
          <p className="text-center text-sm text-warm py-8">No projects yet. Tap + New to create one.</p>
        )}
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </main>

      <TabBar active="projects" onChange={onTabChange} />
    </div>
  );
}
