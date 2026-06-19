import { useCallback, useEffect, useState } from "react";
import { Camera, Plus, Search } from "lucide-react";
import { apiGet } from "../lib/api";
import {
  getUserName,
  getRole,
  resolveActiveClientId,
  setClientId,
  type CloudClient,
} from "../lib/auth";
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
  const [role, setRole] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [clientOptions, setClientOptions] = useState<CloudClient[]>([]);
  const [pendingClientId, setPendingClientId] = useState("");

  const loadProjects = useCallback(async (clientId: string) => {
    setLoading(true);
    setError("");

    const res = await apiGet<Project[] | { error?: string }>(
      `/api/clients/${clientId}/projects`
    );

    if (!res.ok) {
      setError((res.data as { error?: string }).error ?? "Failed to load projects.");
      setProjects([]);
      setLoading(false);
      return;
    }

    if (Array.isArray(res.data)) {
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setProjects(sorted);
    } else {
      setProjects([]);
    }
    setLoading(false);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError("");

    const resolved = await resolveActiveClientId();
    if (resolved.error && !resolved.clients.length) {
      setError(resolved.error);
      setLoading(false);
      return;
    }

    setClientOptions(resolved.clients);

    if (resolved.clientId) {
      setActiveClientId(resolved.clientId);
      setPendingClientId(resolved.clientId);
      await loadProjects(resolved.clientId);
      return;
    }

    if (resolved.clients.length > 1) {
      setPendingClientId(resolved.clients[0]!.id);
      setLoading(false);
      return;
    }

    setError(resolved.error ?? "Could not determine which client to use.");
    setLoading(false);
  }, [loadProjects]);

  useEffect(() => {
    void getUserName().then((n) => setUserName(n ?? ""));
    void getRole().then((r) => setRole(r));
    void bootstrap();
  }, [bootstrap]);

  async function confirmClientSelection() {
    if (!pendingClientId) return;
    await setClientId(pendingClientId);
    setActiveClientId(pendingClientId);
    await loadProjects(pendingClientId);
  }

  async function switchClient(nextId: string) {
    if (!nextId || nextId === activeClientId) return;
    await setClientId(nextId);
    setActiveClientId(nextId);
    setPendingClientId(nextId);
    await loadProjects(nextId);
  }

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const photoTotal = projects.reduce((n, p) => n + (p.project_media?.length ?? 0), 0);
  const activeClientName = clientOptions.find((c) => c.id === activeClientId)?.name;
  const needsClientPick = !activeClientId && clientOptions.length > 1;

  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <div className="bg-canvas px-5 pb-6 pt-8">
        <FWSectionLabel className="mb-1.5">{getGreeting()}</FWSectionLabel>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-fw-display text-[clamp(24px,5vw,32px)] leading-tight tracking-tight text-ink">
              {activeClientName || userName || "Your projects"}
            </h1>
            <p className="mt-1 font-fw-body text-xs text-warm">
              {activeClientId && projects.length > 0
                ? `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${photoTotal} photos stored`
                : activeClientId
                  ? "No projects yet · Upload your first job"
                  : role === "AGENCY_ADMIN"
                    ? "Choose a client to view their field projects"
                    : "Loading your workspace…"}
            </p>
          </div>
          {userName ? <AvatarInitials name={userName} size={36} /> : null}
        </div>

        {role === "AGENCY_ADMIN" && clientOptions.length > 1 && activeClientId && (
          <div className="mt-4">
            <label className="mb-1.5 block font-fw-body text-[10px] font-bold uppercase tracking-wider text-warm">
              Client
            </label>
            <select
              value={activeClientId}
              onChange={(e) => void switchClient(e.target.value)}
              className="w-full rounded-xl border border-black/[0.08] bg-card px-3 py-2.5 font-fw-body text-[13px] text-ink outline-none focus:border-black/20"
            >
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!needsClientPick && (
        <>
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
        </>
      )}

      <main
        className="flex-1 px-5"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        {needsClientPick && (
          <div className="rounded-[20px] border border-black/[0.08] bg-card p-5">
            <FWSectionLabel className="mb-2">Select client</FWSectionLabel>
            <p className="mb-4 font-fw-body text-[13px] text-warm">
              Your agency account manages multiple clients. Choose which client&apos;s projects to
              work on in the field.
            </p>
            <select
              value={pendingClientId}
              onChange={(e) => setPendingClientId(e.target.value)}
              className="mb-4 w-full rounded-xl border border-black/[0.08] bg-page px-3 py-3 font-fw-body text-[13px] text-ink outline-none focus:border-black/20"
            >
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FWButton
              variant="primary"
              style={{ width: "100%", height: 44, borderRadius: 12 }}
              onClick={() => void confirmClientSelection()}
            >
              Continue
            </FWButton>
          </div>
        )}

        {!needsClientPick && (
          <div className="mb-3 flex items-center justify-between">
            <FWSectionLabel>All projects</FWSectionLabel>
            {!loading && projects.length > 0 && (
              <span className="font-fw-body text-[11px] font-semibold text-soil-3">
                {filtered.length} shown
              </span>
            )}
          </div>
        )}

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
              onClick={() => void bootstrap()}
            >
              Retry
            </button>
          </div>
        )}

        {!needsClientPick && !loading && !error && filtered.length === 0 && activeClientId && (
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

        {!needsClientPick && (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>

      <TabBar active="projects" onChange={onTabChange} />
    </div>
  );
}
