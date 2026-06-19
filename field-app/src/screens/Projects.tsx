import { useCallback, useEffect, useState } from "react";
import { Camera, Plus, Search } from "lucide-react";
import { apiGet } from "../lib/api";
import { getClientId, getUserName } from "../lib/auth";
import { ProjectCard, type Project } from "../components/ProjectCard";
import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";
import { AvatarInitials, FWButton, FWSectionLabel, getGreeting } from "../components/fw";

type Props = {
  onTabChange: (tab: TabId) => void;
};

export function Projects({ onTabChange }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");
  const [search, setSearch] = useState("");

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

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const photoTotal = projects.reduce((n, p) => n + (p.project_media?.length ?? 0), 0);

  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      {/* Greeting hero — mirrors cloud dashboard home */}
      <div className="bg-canvas px-5 pb-6 pt-8">
        <FWSectionLabel className="mb-1.5">{getGreeting()}</FWSectionLabel>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-fw-display text-[clamp(24px,5vw,32px)] leading-tight tracking-tight text-ink">
              {userName || "Your projects"}
            </h1>
            <p className="mt-1 font-fw-body text-xs text-warm">
              {projects.length > 0
                ? `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${photoTotal} photos stored`
                : "No projects yet · Upload your first job"}
            </p>
          </div>
          {userName ? <AvatarInitials name={userName} size={36} /> : null}
        </div>
      </div>

      {/* Quick action pills */}
      <div
        className="pills-scroll mb-2 flex gap-2 overflow-x-auto px-5 py-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <FWButton variant="secondary" style={{ height: 40, flexShrink: 0 }}>
          <Plus size={15} strokeWidth={2.2} />
          New project
        </FWButton>
        <FWButton
          variant="primary"
          style={{ height: 40, flexShrink: 0 }}
          onClick={() => onTabChange("capture")}
        >
          <Camera size={15} strokeWidth={2.2} />
          Capture
        </FWButton>
      </div>

      {/* Search */}
      <div className="relative mx-5 mb-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-muted"
          strokeWidth={1.8}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full rounded-xl border border-black/[0.08] bg-card py-2.5 pl-9 pr-4 font-fw-body text-[13px] text-ink placeholder:text-warm-muted outline-none focus:border-black/20"
        />
      </div>

      <main
        className="flex-1 px-5"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <FWSectionLabel>All projects</FWSectionLabel>
          {!loading && projects.length > 0 && (
            <span className="font-fw-body text-[11px] font-semibold text-soil-3">
              {filtered.length} shown
            </span>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-fw-body text-sm text-red-700">
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

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center rounded-[20px] border border-black/[0.08] bg-card px-6 py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-black/[0.07] bg-sunken">
              <Camera className="h-6 w-6 text-warm" strokeWidth={1.5} />
            </div>
            <p className="font-fw-display mb-2 text-xl text-ink">
              {search ? "No results" : "No projects yet"}
            </p>
            <p className="mb-6 max-w-[220px] font-fw-body text-[13px] text-warm">
              {search
                ? "No projects match your search."
                : "Create a project on cloud.segmiq.com, then capture photos here."}
            </p>
            {!search && (
              <FWButton variant="primary" style={{ height: 44, borderRadius: 12, padding: "0 20px" }}>
                <Plus size={15} strokeWidth={2.5} />
                Create a project
              </FWButton>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </main>

      <TabBar active="projects" onChange={onTabChange} />
    </div>
  );
}
