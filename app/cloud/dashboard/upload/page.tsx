"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Camera, Check, ChevronRight, Loader2, Plus, X, ArrowRight, Folder,
} from "lucide-react";
import { InstallPrompt } from "@/app/cloud/components/InstallPrompt";
import { IOSInstallBanner } from "@/app/cloud/components/IOSInstallBanner";
import { getProjectCardStyles } from "@/app/cloud/components/ProjectCard";

type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media: { id: string; public_url: string; display_order: number }[];
};

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
};

const CATEGORIES = [
  "Construction", "Solar Installation", "Landscaping", "Electrical",
  "Plumbing", "Interior Design", "Roofing", "Fencing", "Events", "Architecture", "Other",
];

export default function CloudUploadPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [showNewSheet, setShowNewSheet] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) return;
    fetch(`/api/clients/${session.clientId}/projects`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const sorted = (data as Project[]).sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
          setProjects(sorted);
        }
      })
      .catch(() => {});
  }, [session?.clientId]);

  useEffect(() => {
    fetchProjects();
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch((err) => console.error("[SW] Registration failed:", err));
    }
  }, [fetchProjects]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const items: QueueItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "pending",
    }));
    setQueue(items);
    setAllDone(false);
    e.target.value = "";
  }

  async function uploadAll() {
    if (!session?.clientId || !selectedProject || !queue.length) return;
    setUploading(true);
    let doneCount = 0;

    for (const item of queue) {
      setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "uploading" } : q));
      try {
        const presignRes = await fetch("/api/storage/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.file.name,
            contentType: item.file.type || "image/jpeg",
            clientId: session.clientId,
            projectId: selectedProject.id,
            purpose: "media",
          }),
        });
        if (!presignRes.ok) throw new Error("Presign failed");
        const { uploadUrl, key, publicUrl } = (await presignRes.json()) as {
          uploadUrl: string; key: string; publicUrl: string;
        };

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": item.file.type || "image/jpeg" },
          body: item.file,
        });

        await fetch(`/api/clients/${session.clientId}/projects/${selectedProject.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storage_key: key,
            public_url: publicUrl,
            file_size_bytes: item.file.size,
          }),
        });

        doneCount++;
        setQueue((prev) =>
          prev.map((q) => q.id === item.id ? { ...q, status: "done", progress: 100 } : q)
        );
      } catch {
        setQueue((prev) =>
          prev.map((q) => q.id === item.id ? { ...q, status: "error" } : q)
        );
      }
    }

    setUploading(false);
    if (doneCount > 0) setAllDone(true);
  }

  async function handleCreateProject() {
    if (!newTitle.trim() || !session?.clientId) return;
    setCreatingProject(true);
    setCreateError("");
    try {
      const res = await fetch(`/api/clients/${session.clientId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory || null,
          location: newLocation.trim() || null,
          is_public: true,
        }),
      });
      const data = (await res.json()) as Project & { error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create project.");
        return;
      }
      setProjects((prev) => [data, ...prev]);
      setSelectedProject(data);
      setShowNewSheet(false);
      setNewTitle("");
      setNewCategory("");
      setNewLocation("");
    } catch {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreatingProject(false);
    }
  }

  function resetUpload() {
    setQueue([]);
    setAllDone(false);
  }

  const recent5 = projects.slice(0, 5);
  const pendingCount = queue.filter((q) => q.status === "pending" || q.status === "uploading").length;
  const doneFiles = queue.filter((q) => q.status === "done");

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F0] font-cloud-body">
      <div className="flex-1 px-5 py-5 lg:px-8">
        {allDone ? (
          /* ── All done state ── */
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#1C1410]" style={{ boxShadow: '0 8px 24px rgba(28,20,16,0.25)' }}>
              <Check className="h-8 w-8 text-[#D4FF4F]" />
            </div>
            <h2 className="mb-2 font-cloud-display text-[26px] text-[#0a0a0a]">Upload complete!</h2>
            <p className="mb-8 text-[14px] text-[#666660] font-cloud-body">
              {doneFiles.length} photo{doneFiles.length !== 1 ? "s" : ""} added to{" "}
              <span className="font-semibold text-[#0a0a0a]">{selectedProject?.title}</span>.
            </p>
            <div className="flex w-full max-w-xs flex-col gap-3">
              <button
                onClick={resetUpload}
                className="w-full rounded-xl border border-black/[0.1] bg-white py-3 text-[14px] font-semibold text-[#0a0a0a] hover:bg-[#F5F5F0] transition-colors font-cloud-body"
              >
                Upload more photos
              </button>
              <button
                onClick={() => router.push(`/cloud/dashboard/projects/${selectedProject!.id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1410] py-3 text-[14px] font-bold text-[#D4FF4F] hover:bg-[#2E2218] transition-colors font-cloud-body"
              >
                View project <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : !selectedProject ? (
          /* ── State A: no project selected ── */
          <>
            <p className="font-cloud-display text-[22px] text-[#0a0a0a] mb-1">Upload photos</p>
            <p className="text-[13px] text-[#999990] font-cloud-body mb-1">Choose a project to add photos to.</p>
            <p className="text-[12px] text-[#B4A898] font-cloud-body mb-5">
              Uploading from desktop?{" "}
              <a href="/cloud/dashboard/upload/desktop" className="font-semibold text-[#666660] underline underline-offset-2">
                Use bulk upload →
              </a>
            </p>

            <div className="mb-3 space-y-2">
              {recent5.map((p) => {
                const s = getProjectCardStyles(p.category);
                const coverUrl = [...(p.project_media ?? [])]
                  .sort((a, b) => a.display_order - b.display_order)[0]?.public_url;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProject(p)}
                    className={`flex w-full items-center gap-4 rounded-[20px] border px-4 py-3.5 text-left transition-all active:scale-[0.99] ${s.gradient} ${s.border}`}
                  >
                    <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-white/40">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Folder className={`h-5 w-5 opacity-40 ${s.text}`} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-[14px] font-semibold font-cloud-body ${s.text}`}>{p.title}</p>
                      <p className={`text-[12px] font-cloud-body ${s.subtext}`}>
                        {p.project_media?.length ?? 0} photos{p.category ? ` · ${p.category}` : ""}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 opacity-40 ${s.text}`} />
                  </button>
                );
              })}
            </div>

            {/* New project inline form toggle */}
            {!showNewSheet ? (
              <button
                onClick={() => setShowNewSheet(true)}
                className="flex w-full items-center gap-3 rounded-[20px] border-2 border-dashed border-[#D8D8D0] bg-[#EEEEE8] px-4 py-3.5 text-left transition-colors hover:border-[#C0C0B8] active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white">
                  <Plus className="h-4 w-4 text-[#999990]" />
                </div>
                <span className="text-[14px] text-[#999990] font-cloud-body">Create new project</span>
              </button>
            ) : (
              <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 space-y-3">
                <p className="text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase font-cloud-body">New project</p>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  placeholder="Project name"
                  className="w-full rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#666660] outline-none focus:border-black/[0.2] font-cloud-body"
                >
                  <option value="">Category (optional)</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="w-full rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
                />
                <button
                  onClick={() => void handleCreateProject()}
                  disabled={!newTitle.trim() || creatingProject}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1410] py-3 text-[13px] font-bold text-[#D4FF4F] disabled:opacity-60 hover:bg-[#2E2218] transition-colors font-cloud-body"
                >
                  {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {creatingProject ? "Creating…" : "Create & continue →"}
                </button>
                {createError && (
                  <p className="text-center text-[13px] text-red-500 font-cloud-body">{createError}</p>
                )}
                <button
                  onClick={() => setShowNewSheet(false)}
                  className="w-full text-[12px] text-[#999990] font-cloud-body py-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : queue.length === 0 ? (
          /* ── State B: project selected, no photos yet ── */
          <div className="flex flex-col">
            {/* Selected project header */}
            <button
              onClick={() => setSelectedProject(null)}
              className="mb-5 flex items-center gap-1.5 text-[12px] text-[#999990] hover:text-[#0a0a0a] transition-colors font-cloud-body"
            >
              ← Back to projects
            </button>

            <div className={`mb-5 flex items-center gap-3 rounded-[20px] border px-4 py-3.5 ${getProjectCardStyles(selectedProject.category).gradient} ${getProjectCardStyles(selectedProject.category).border}`}>
              <div>
                <p className={`text-[15px] font-semibold font-cloud-body ${getProjectCardStyles(selectedProject.category).text}`}>{selectedProject.title}</p>
                <p className={`text-[12px] font-cloud-body ${getProjectCardStyles(selectedProject.category).subtext}`}>{selectedProject.project_media?.length ?? 0} photos</p>
              </div>
            </div>

            {/* Big upload zone */}
            <label htmlFor="photo-input" className="flex flex-col items-center justify-center gap-4 rounded-[20px] border-2 border-dashed border-[#60E8A0]/40 bg-gradient-to-br from-[#F0FFF8] via-[#E0FFF0] to-[#C8FFE0] py-16 cursor-pointer hover:border-[#60E8A0]/70 transition-colors">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D4FF4F]" style={{ boxShadow: 'var(--cloud-shadow-elevated)' }}>
                <Camera className="h-8 w-8 text-[#1C1410]" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-cloud-display text-[20px] text-[#004D30]">Select photos</p>
                <p className="mt-1 text-[13px] text-[#00875A] font-cloud-body">Tap to choose from your gallery</p>
              </div>
              <input
                ref={fileInputRef}
                id="photo-input"
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        ) : (
          /* ── State C: queue loaded ── */
          <div className="flex flex-col">
            <button
              onClick={() => { setSelectedProject(null); setQueue([]); }}
              className="mb-5 flex items-center gap-1.5 text-[12px] text-[#999990] hover:text-[#0a0a0a] transition-colors font-cloud-body"
            >
              ← Back
            </button>

            {/* Progress / queue summary */}
            <div className="mb-4 rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-4">
              <div className="flex items-center gap-3 mb-3">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#666660]" />
                ) : (
                  <Camera className="h-5 w-5 text-[#666660]" strokeWidth={1.8} />
                )}
                <div>
                  <p className="text-[14px] font-semibold text-[#0a0a0a] font-cloud-body">
                    {uploading ? "Uploading…" : `${queue.length} photo${queue.length !== 1 ? "s" : ""} ready`}
                  </p>
                  <p className="text-[12px] text-[#666660] font-cloud-body">
                    {uploading
                      ? `${doneFiles.length} of ${queue.length} done`
                      : `To: ${selectedProject.title}`}
                  </p>
                </div>
              </div>
              {uploading && (
                <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1C1410] transition-all"
                    style={{ width: `${queue.length ? (doneFiles.length / queue.length) * 100 : 0}%` }}
                  />
                </div>
              )}
            </div>

            {/* Thumbnail grid */}
            <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {queue.map((f) => (
                <div key={f.id} className="relative aspect-square overflow-hidden rounded-xl bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                  {f.status === "uploading" && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
                      <div className="h-full bg-[#1C1410] transition-all duration-200" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                  {f.status === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  )}
                  {f.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                      <X className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!uploading && !allDone && (
              <button
                onClick={() => void uploadAll()}
                disabled={pendingCount === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1410] py-4 text-[14px] font-bold text-[#D4FF4F] disabled:opacity-50 hover:bg-[#2E2218] transition-colors font-cloud-body"
              >
                Upload {queue.length} photo{queue.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>
      <InstallPrompt />
      <IOSInstallBanner />
    </div>
  );
}
