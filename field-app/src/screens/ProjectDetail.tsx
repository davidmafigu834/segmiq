import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, Loader2, RefreshCw } from "lucide-react";
import type { Project } from "../components/ProjectCard";
import { OfflineBanner } from "../components/OfflineBanner";
import { FWSectionLabel } from "../components/fw";
import { getClientId } from "../lib/auth";
import { fetchProjectMedia, type ProjectMedia } from "../lib/projects";

type Props = {
  project: Project;
  onBack: () => void;
  onCapture: (projectId: string) => void;
  onOpenAccount: () => void;
};

export function ProjectDetail({ project, onBack, onCapture, onOpenAccount }: Props) {
  const [media, setMedia] = useState<ProjectMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const clientId = await getClientId();
    if (!clientId) {
      setError("Missing client ID. Please sign in again.");
      setLoading(false);
      return;
    }
    const { media: list, error: err } = await fetchProjectMedia(clientId, project.id);
    if (err) setError(err);
    else {
      setError("");
      setMedia(list.sort((a, b) => a.display_order - b.display_order));
    }
    setLoading(false);
    setRefreshing(false);
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleRefresh() {
    setRefreshing(true);
    void load();
  }

  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <OfflineBanner />

      <div className="border-b border-black/[0.06] bg-canvas px-5 pb-5 pt-8">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] bg-card"
            aria-label="Back"
          >
            <ArrowLeft className="h-[18px] w-[18px] text-soil-3" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onOpenAccount}
            className="font-fw-body text-xs font-semibold text-soil-3 underline"
          >
            Account
          </button>
        </div>
        <FWSectionLabel className="mb-1">Project</FWSectionLabel>
        <h1 className="font-fw-display text-[clamp(22px,5vw,28px)] leading-tight text-ink">
          {project.title}
        </h1>
        <p className="mt-1 font-fw-body text-xs text-warm">
          {project.category || "Project"} · {media.length} photo{media.length !== 1 ? "s" : ""}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onCapture(project.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime py-3 font-fw-body text-[13px] font-bold text-ink"
          >
            <Camera size={16} strokeWidth={2.5} />
            Add photos
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-black/[0.08] bg-card"
            aria-label="Refresh"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin text-soil-3" />
            ) : (
              <RefreshCw className="h-4 w-4 text-soil-3" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <main className="flex-1 px-5 py-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button type="button" className="mt-2 block text-xs font-semibold underline" onClick={handleRefresh}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && media.length === 0 && (
          <div className="flex flex-col items-center rounded-[20px] border border-black/[0.08] bg-card px-6 py-10 text-center">
            <Camera className="mb-4 h-8 w-8 text-warm" strokeWidth={1.5} />
            <p className="font-fw-display text-lg text-ink">No photos yet</p>
            <p className="mt-2 font-fw-body text-[13px] text-warm">
              Capture site photos and they&apos;ll show up here.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {media.map((m) => (
            <div
              key={m.id}
              className="aspect-square overflow-hidden rounded-xl border border-black/[0.08] bg-sunken"
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={m.public_url} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
