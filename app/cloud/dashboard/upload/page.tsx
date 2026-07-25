"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Camera, Check, ChevronRight, Loader2, Plus, X, ArrowRight, Folder,
} from "lucide-react";
import { generateVideoThumbnail, formatFileSize } from "@/app/cloud/lib/video-thumbnail";
import { uploadProjectMediaFile, uploadErrorMessage } from "@/app/cloud/lib/upload-project-media";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import { SkeletonListRows } from "@/app/cloud/components/SkeletonCard";

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
  fileType: "photo" | "video";
  thumbnailBlob?: Blob;
  duration?: number;
};

const CATEGORIES = [
  "Construction", "Solar Installation", "Landscaping", "Electrical",
  "Plumbing", "Interior Design", "Roofing", "Fencing", "Events", "Architecture", "Other",
];

export default function CloudUploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
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
    if (!session?.clientId) {
      if (status !== "loading") setLoadingProjects(false);
      return;
    }
    setLoadingProjects(true);
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
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, [session?.clientId, status]);

  useEffect(() => {
    if (status === "loading") return;
    fetchProjects();
  }, [status, fetchProjects]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(e.target.files ?? []).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    e.target.value = "";
    if (!rawFiles.length) return;

    const items: QueueItem[] = [];
    for (const file of rawFiles) {
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) continue;

      let previewUrl = URL.createObjectURL(file);
      let duration: number | undefined;
      let thumbnailBlob: Blob | undefined;

      if (isVideo) {
        try {
          const result = await generateVideoThumbnail(file);
          thumbnailBlob = result.thumbnailBlob;
          duration = result.duration;
          previewUrl = URL.createObjectURL(thumbnailBlob);
        } catch (err) {
          console.warn("Thumbnail generation failed:", err);
        }
      }

      items.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl,
        progress: 0,
        status: "pending",
        fileType: isVideo ? "video" : "photo",
        thumbnailBlob,
        duration,
      });
    }

    if (!items.length) return;
    setQueue(items);
    setAllDone(false);
  }

  async function uploadAll() {
    if (!session?.clientId || !selectedProject || !queue.length) return;
    setUploading(true);
    let doneCount = 0;

    for (const item of queue) {
      const isVideo = item.fileType === "video";
      setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "uploading" } : q));
      try {
        const { key, publicUrl } = await uploadProjectMediaFile(
          item.file,
          session.clientId,
          selectedProject.id
        );

        let thumbnailUrl: string | undefined;
        if (isVideo && item.thumbnailBlob) {
          try {
            const thumbFile = new File([item.thumbnailBlob], `thumb_${item.file.name}.jpg`, {
              type: "image/jpeg",
            });
            const thumb = await uploadProjectMediaFile(
              thumbFile,
              session.clientId,
              selectedProject.id
            );
            thumbnailUrl = thumb.publicUrl;
          } catch (err) {
            console.warn("Thumbnail upload failed:", err);
          }
        }

        const mediaRes = await fetch(`/api/clients/${session.clientId}/projects/${selectedProject.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: isVideo ? "video" : "photo",
            storage_key: key,
            public_url: publicUrl,
            thumbnail_url: thumbnailUrl,
            duration_seconds: item.duration,
            file_size_bytes: item.file.size,
          }),
        });
        const savedMedia = (await mediaRes.json()) as { id: string };

        if (!isVideo) {
          await fetch("/api/cloud/watermark/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaId: savedMedia.id, originalKey: key, clientId: session.clientId }),
          });
        }

        doneCount++;
        setQueue((prev) =>
          prev.map((q) => q.id === item.id ? { ...q, status: "done", progress: 100 } : q)
        );
      } catch (err) {
        console.error("Upload failed:", uploadErrorMessage(err));
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

  if (status === "loading" || (loadingProjects && !selectedProject && !allDone)) {
    return (
      <CloudPage>
        <SkeletonListRows count={5} />
      </CloudPage>
    );
  }

  return (
    <CloudPage>
        {allDone ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--cloud-ink)] shadow-[var(--cloud-shadow-elevated)]">
              <Check className="h-8 w-8 text-[var(--cloud-accent)]" strokeWidth={2.2} />
            </div>
            <h2 className="mb-2 font-cloud-display text-[26px] text-[var(--cloud-text-primary)]">
              Upload complete!
            </h2>
            <p className="mb-8 text-[14px] text-[var(--cloud-text-secondary)]">
              {doneFiles.length} file{doneFiles.length !== 1 ? "s" : ""} added to{" "}
              <span className="font-semibold text-[var(--cloud-text-primary)]">{selectedProject?.title}</span>.
            </p>
            <div className="flex w-full max-w-xs flex-col gap-3">
              <button type="button" onClick={resetUpload} className="cloud-btn-ghost h-12 w-full">
                Upload more
              </button>
              <button
                type="button"
                onClick={() => router.push(`/cloud/dashboard/projects/${selectedProject!.id}`)}
                className="cloud-btn-primary h-12 w-full"
              >
                View project
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : !selectedProject ? (
          <>
            <div className="mb-6">
              <p className="cloud-section-label">Upload</p>
              <h1 className="font-cloud-display text-[clamp(26px,4vw,34px)] leading-[1.1] tracking-[-0.02em] text-[var(--cloud-text-primary)]">
                Choose a project
              </h1>
              <p className="mt-2 text-[13px] text-[var(--cloud-text-secondary)]">
                Select where these photos go.{" "}
                <a
                  href="/cloud/dashboard/upload/desktop"
                  className="font-semibold text-[var(--cloud-text-primary)] underline-offset-2 hover:underline"
                >
                  Bulk upload on desktop →
                </a>
              </p>
            </div>

            <div className="mb-3 space-y-2">
              {recent5.map((p) => {
                const coverUrl = [...(p.project_media ?? [])]
                  .sort((a, b) => a.display_order - b.display_order)[0]?.public_url;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProject(p)}
                    className="cloud-card flex w-full items-center gap-4 px-4 py-3.5 text-left transition-transform active:scale-[0.99] hover:bg-[var(--cloud-surface-hover)]"
                  >
                    <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--cloud-surface-muted)]">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Folder className="h-5 w-5 text-[var(--cloud-text-tertiary)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[var(--cloud-text-primary)]">
                        {p.title}
                      </p>
                      <p className="text-[12px] text-[var(--cloud-text-tertiary)]">
                        {p.project_media?.length ?? 0} photos{p.category ? ` · ${p.category}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--cloud-text-tertiary)]" />
                  </button>
                );
              })}
            </div>

            {!showNewSheet ? (
              <button
                type="button"
                onClick={() => setShowNewSheet(true)}
                className="flex w-full items-center gap-3 rounded-[var(--cloud-radius-lg)] border border-dashed border-[var(--cloud-border-hover)] bg-[var(--cloud-surface-muted)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--cloud-surface-hover)] active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--cloud-surface)] border border-[var(--cloud-border)]">
                  <Plus className="h-4 w-4 text-[var(--cloud-text-secondary)]" />
                </div>
                <span className="text-[14px] font-medium text-[var(--cloud-text-secondary)]">
                  Create new project
                </span>
              </button>
            ) : (
              <div className="cloud-card space-y-3 p-5">
                <p className="cloud-section-label mb-0">New project</p>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  placeholder="Project name"
                  className="cloud-input cloud-input--lg"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="cloud-select cloud-select--lg w-full"
                >
                  <option value="">Category (optional)</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="cloud-input cloud-input--lg"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateProject()}
                  disabled={!newTitle.trim() || creatingProject}
                  className="cloud-btn-primary h-12 w-full disabled:opacity-60"
                >
                  {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {creatingProject ? "Creating…" : "Create & continue"}
                </button>
                {createError ? (
                  <p className="text-[13px] text-red-500">{createError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowNewSheet(false)}
                  className="w-full py-2 text-[12px] font-medium text-[var(--cloud-text-tertiary)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : queue.length === 0 ? (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="mb-5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--cloud-text-secondary)] transition-colors hover:text-[var(--cloud-text-primary)]"
            >
              ← Back to projects
            </button>

            <div className="cloud-card mb-5 flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cloud-surface-muted)]">
                <Folder className="h-5 w-5 text-[var(--cloud-text-secondary)]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[var(--cloud-text-primary)]">
                  {selectedProject.title}
                </p>
                <p className="text-[12px] text-[var(--cloud-text-tertiary)]">
                  {selectedProject.project_media?.length ?? 0} photos
                </p>
              </div>
            </div>

            <label
              htmlFor="photo-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-[var(--cloud-radius-lg)] border border-dashed border-[var(--cloud-border-hover)] bg-[var(--cloud-surface)] py-16 transition-colors hover:bg-[var(--cloud-surface-hover)]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--cloud-ink)] shadow-[var(--cloud-shadow-elevated)]">
                <Camera className="h-7 w-7 text-[var(--cloud-accent)]" strokeWidth={1.7} />
              </div>
              <div className="text-center px-4">
                <p className="font-cloud-display text-[22px] text-[var(--cloud-text-primary)]">
                  Add photos or videos
                </p>
                <p className="mt-1 text-[13px] text-[var(--cloud-text-secondary)]">
                  From your gallery or camera
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--cloud-text-tertiary)]">
                  Photos up to 20MB · Videos up to 200MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="photo-input"
                type="file"
                accept="image/*,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/3gpp"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => { void handleFileSelect(e); }}
              />
            </label>
          </div>
        ) : (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => { setSelectedProject(null); setQueue([]); }}
              className="mb-5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--cloud-text-secondary)] transition-colors hover:text-[var(--cloud-text-primary)]"
            >
              ← Back
            </button>

            <div className="cloud-card mb-4 p-4">
              <div className="mb-3 flex items-center gap-3">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--cloud-text-secondary)]" />
                ) : (
                  <Camera className="h-5 w-5 text-[var(--cloud-text-secondary)]" strokeWidth={1.8} />
                )}
                <div>
                  <p className="text-[14px] font-semibold text-[var(--cloud-text-primary)]">
                    {uploading ? "Uploading…" : `${queue.length} file${queue.length !== 1 ? "s" : ""} ready`}
                  </p>
                  <p className="text-[12px] text-[var(--cloud-text-tertiary)]">
                    {uploading
                      ? `${doneFiles.length} of ${queue.length} done`
                      : `To: ${selectedProject.title}`}
                  </p>
                </div>
              </div>
              {uploading ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cloud-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--cloud-ink)] transition-all"
                    style={{ width: `${queue.length ? (doneFiles.length / queue.length) * 100 : 0}%` }}
                  />
                </div>
              ) : null}
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {queue.map((f) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--cloud-surface-muted)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                    {f.status === "uploading" && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
                        <div className="h-full bg-[var(--cloud-ink)] transition-all duration-200" style={{ width: `${f.progress}%` }} />
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
                  <div className="flex items-center gap-1">
                    {f.fileType === "video" ? (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] bg-[var(--cloud-ink)] text-[var(--cloud-accent)]">
                        Video
                      </span>
                    ) : null}
                    <span className="truncate text-[10px] text-[var(--cloud-text-tertiary)]">
                      {formatFileSize(f.file.size)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {!uploading && !allDone ? (
              <button
                type="button"
                onClick={() => void uploadAll()}
                disabled={pendingCount === 0}
                className="cloud-btn-primary h-12 w-full disabled:opacity-50"
              >
                Upload {queue.length} {queue.some((q) => q.fileType === "video") ? "file" : "photo"}
                {queue.length !== 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
        )}
    </CloudPage>
  );
}
