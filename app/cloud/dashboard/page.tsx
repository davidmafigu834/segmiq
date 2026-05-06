"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Camera, Plus, ArrowRight, Folder } from "lucide-react";
import { NewProjectSlideOver } from "./projects/NewProjectSlideOver";

type MediaItem = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media: MediaItem[];
};

export default function CloudDashboardHome() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/clients/${session.clientId}/projects`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setProjects(data as Project[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.clientId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const recent = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  function cover(p: Project): string | null {
    const sorted = [...(p.project_media ?? [])].sort(
      (a, b) => a.display_order - b.display_order
    );
    return sorted[0]?.public_url ?? null;
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#D4FF4F]" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-5">
      {projects.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#1a1a1a]">
            <Camera className="h-5 w-5 text-[#888]" strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 text-[22px] font-semibold tracking-tight text-white">Add your first project</h2>
          <p className="mb-6 max-w-xs text-[13px] text-[#555]">
            Start by creating a project for a job you&apos;re working on. Then upload photos
            straight from your phone.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-md bg-[#D4FF4F] px-4 py-2 text-[13px] font-semibold text-black hover:bg-[#c8f244] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create a project
          </button>
        </div>
      ) : (
        <>
          {/* Recent projects */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[#555] uppercase tracking-[0.08em]">01 / RECENT PROJECTS</p>
              <Link
                href="/cloud/dashboard/projects"
                className="flex items-center gap-1 text-[12px] text-[#555] hover:text-[#888] transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((p) => (
                <Link
                  key={p.id}
                  href={`/cloud/dashboard/projects/${p.id}`}
                  className="group relative rounded-lg overflow-hidden bg-[#111] border border-white/[0.08] hover:border-white/[0.15] transition-colors cursor-pointer aspect-[4/3]"
                >
                  {cover(p) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cover(p)!}
                      alt={p.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Folder className="h-8 w-8 text-white/20" />
                    </div>
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}
                  />
                  {p.category && (
                    <span className="absolute top-2.5 left-2.5 flex h-5 items-center px-2 text-[10px] font-medium rounded bg-black/60 text-white/80 border border-white/10 backdrop-blur-sm">
                      {p.category}
                    </span>
                  )}
                  <div className="absolute bottom-2.5 left-3 right-3">
                    <p className="text-[13px] font-semibold text-white leading-tight">{p.title}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {p.project_media?.length ?? 0} photos
                    </p>
                  </div>
                </Link>
              ))}

              {/* New project card */}
              <button
                onClick={() => setShowNew(true)}
                className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.12] hover:border-white/[0.25] hover:bg-white/[0.02] transition-colors cursor-pointer aspect-[4/3] gap-2"
              >
                <div className="w-8 h-8 rounded-full border border-white/[0.15] flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#555]" />
                </div>
                <span className="text-[12px] text-[#555]">New project</span>
              </button>
            </div>
          </div>

          {/* Quick upload shortcut */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#111] border border-white/[0.08] rounded-lg hover:border-white/[0.15] transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-md bg-[#1a1a1a] border border-white/[0.08] flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4 text-[#888]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-[#888] font-medium">Upload photos to an existing project</p>
            </div>
            <Link
              href="/cloud/dashboard/upload"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 h-7 px-3 bg-transparent border border-white/[0.15] text-[12px] text-[#888] rounded-md hover:border-white/[0.3] hover:text-white transition-colors shrink-0"
            >
              Upload
            </Link>
          </div>
        </>
      )}

      {session?.clientId && (
        <NewProjectSlideOver
          clientId={session.clientId}
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}
