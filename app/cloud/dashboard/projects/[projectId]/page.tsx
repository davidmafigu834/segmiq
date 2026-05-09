"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  ArrowLeft, BarChart2, Camera, Check, ChevronLeft, ChevronRight, Copy,
  Download, MoreVertical, Pencil, Trash2, X,
  MapPin, Calendar,
} from "lucide-react";
import Link from "next/link";
import { getProjectCardStyles } from "@/app/cloud/components/ProjectCard";

type MediaItem = {
  id: string;
  public_url: string;
  storage_key: string;
  display_order: number;
  caption: string | null;
};

type Project = {
  id: string;
  title: string;
  category: string | null;
  location: string | null;
  completion_date: string | null;
  description: string | null;
  is_featured: boolean;
  is_public: boolean;
  client_id: string;
  slug: string;
  project_media: MediaItem[];
};

type UploadFile = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
};

async function pooled<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [draggingOver, setDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  const [toastMsg, setToastMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  }

  const fetchProject = useCallback(async () => {
    if (!session?.clientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${session.clientId}/projects`);
      const list = (await res.json()) as Project[];
      const found = list.find((p) => p.id === projectId);
      if (!found) { router.push("/cloud/dashboard/projects"); return; }
      setProject(found);
      setTitleDraft(found.title);
      setDescDraft(found.description ?? "");
      const sorted = [...(found.project_media ?? [])].sort((a, b) => a.display_order - b.display_order);
      setMedia(sorted);
    } finally {
      setLoading(false);
    }
  }, [session?.clientId, projectId, router]);

  useEffect(() => { void fetchProject(); }, [fetchProject]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIdx === null) return;
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i === null || i === 0 ? i : i - 1));
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null || i === media.length - 1 ? i : i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, media.length]);

  async function saveTitle() {
    if (!project || !session?.clientId || titleDraft.trim() === project.title) {
      setEditingTitle(false);
      return;
    }
    await fetch(`/api/clients/${session.clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim() }),
    });
    setProject((p) => p ? { ...p, title: titleDraft.trim() } : p);
    setEditingTitle(false);
  }

  async function saveDesc() {
    if (!project || !session?.clientId) { setEditingDesc(false); return; }
    await fetch(`/api/clients/${session.clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: descDraft.trim() || null }),
    });
    setProject((p) => p ? { ...p, description: descDraft.trim() || null } : p);
    setEditingDesc(false);
  }

  async function saveCaption(mediaId: string, caption: string) {
    if (!session?.clientId) return;
    await fetch(`/api/clients/${session.clientId}/projects/${projectId}/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: caption || null }),
    });
    setMedia((prev) => prev.map((m) => m.id === mediaId ? { ...m, caption: caption || null } : m));
  }

  async function deleteMedia(mediaId: string) {
    if (!session?.clientId) return;
    await fetch(`/api/clients/${session.clientId}/projects/${projectId}/media/${mediaId}`, {
      method: "DELETE",
    });
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    if (lightboxIdx !== null) setLightboxIdx(null);
  }

  async function handleDeleteProject() {
    if (!project || !session?.clientId) return;
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    await fetch(`/api/clients/${session.clientId}/projects/${project.id}`, { method: "DELETE" });
    router.push("/cloud/dashboard/projects");
  }

  function copyShareLink() {
    const url = `${window.location.origin}/cloud/share/${project!.id}`;
    void navigator.clipboard.writeText(url);
    showToast("Share link copied!");
    setMenuOpen(false);
  }

  function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const newItems: UploadFile[] = images.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "pending",
    }));
    setUploadFiles((prev) => [...prev, ...newItems]);
    void uploadAll(newItems);
  }

  async function uploadSingle(item: UploadFile): Promise<void> {
    if (!session?.clientId) return;
    setUploadFiles((prev) =>
      prev.map((f) => f.id === item.id ? { ...f, status: "uploading" } : f)
    );
    try {
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type || "image/jpeg",
          clientId: session.clientId,
          projectId,
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

      const mediaRes = await fetch(
        `/api/clients/${session.clientId}/projects/${projectId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storage_key: key,
            public_url: publicUrl,
            file_size_bytes: item.file.size,
          }),
        }
      );
      const newMediaItem = (await mediaRes.json()) as MediaItem;

      setMedia((prev) => [...prev, { ...newMediaItem, display_order: prev.length }]);
      setUploadFiles((prev) =>
        prev.map((f) => f.id === item.id ? { ...f, status: "done", progress: 100 } : f)
      );
    } catch {
      setUploadFiles((prev) =>
        prev.map((f) => f.id === item.id ? { ...f, status: "error" } : f)
      );
    }
  }

  async function uploadAll(items: UploadFile[]) {
    const tasks = items.map((item) => () => uploadSingle(item));
    await pooled(tasks, 3);
    setTimeout(() => {
      setUploadFiles((prev) => prev.filter((f) => f.status !== "done"));
    }, 2000);
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination || !session?.clientId) return;
    const reordered = [...media];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updated = reordered.map((m, i) => ({ ...m, display_order: i }));
    setMedia(updated);
    await Promise.all(
      updated.map((m) =>
        fetch(`/api/clients/${session.clientId!}/projects/${projectId}/media/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_order: m.display_order }),
        })
      )
    );
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0]" style={{ padding: '20px 20px 0' }}>
        <div style={{ height: 14, width: 64, background: 'linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite', borderRadius: 4, marginBottom: 14 }} />
        <div style={{ height: 26, width: '65%', background: 'linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite', borderRadius: 6, marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: 12,
                background: 'linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.5s infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (!project) return null;

  const currentMedia = lightboxIdx !== null ? media[lightboxIdx] : null;

  const catStyles = project ? getProjectCardStyles(project.category) : null;

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/cloud/dashboard/projects"
            className="mb-3 flex items-center gap-1.5 text-[12px] text-[#999990] hover:text-[#0a0a0a] transition-colors font-cloud-body"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Projects
          </Link>

          {editingTitle ? (
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={(e) => { if (e.key === "Enter") void saveTitle(); }}
              autoFocus
              className="w-full rounded-xl border border-[#D4FF4F] bg-white px-3 py-1.5 font-cloud-display text-[20px] text-[#0a0a0a] outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="group flex items-center gap-2 text-left"
            >
              <h1 className="font-cloud-display text-[20px] text-[#0a0a0a]">{project.title}</h1>
              <Pencil className="h-3.5 w-3.5 text-[#999990] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {project.category && catStyles && (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-cloud-body ${catStyles.badge}`}>
                {project.category}
              </span>
            )}
            {project.location && (
              <span className="flex items-center gap-1 text-[12px] text-[#999990] font-cloud-body">
                <MapPin className="h-3 w-3" />{project.location}
              </span>
            )}
            {project.completion_date && (
              <span className="flex items-center gap-1 text-[12px] text-[#999990] font-cloud-body">
                <Calendar className="h-3 w-3" />
                {new Date(project.completion_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 rounded-xl bg-[#D4FF4F] px-3 py-2 text-[12px] font-bold text-[#0a0a0a] hover:bg-[#C8F244] transition-colors font-cloud-body"
          >
            <Copy className="h-3.5 w-3.5" />
            Share
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-xl border border-black/[0.08] bg-white p-2 text-[#666660] hover:border-black/[0.15] hover:text-[#0a0a0a] transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-black/[0.08] bg-white py-1.5 shadow-xl">
                  <Link
                    href={`/cloud/dashboard/projects/${projectId}/analytics`}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[#666660] hover:bg-[#F5F5F0] hover:text-[#0a0a0a]"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    View analytics
                  </Link>
                  <button
                    onClick={() => void handleDeleteProject()}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload zone — mint SectionCard */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingOver(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-5 cursor-pointer rounded-[20px] border transition-all ${
          draggingOver
            ? "border-[#60E8A0]/60 bg-gradient-to-br from-[#E0FFF0] to-[#A8FFD0]"
            : "border-[#60E8A0]/30 bg-gradient-to-br from-[#F0FFF8] via-[#E0FFF0] to-[#C8FFE0]"
        }`}
        style={{ minHeight: 100 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
        <div className="flex flex-col items-center justify-center py-3 px-5">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/70" style={{ boxShadow: 'var(--cloud-shadow-card)' }}>
            <Camera className={`h-5 w-5 ${draggingOver ? "text-[#00875A]" : "text-[#00875A]"}`} strokeWidth={1.8} />
          </div>
          <p className="font-cloud-display" style={{ fontSize: 15, color: '#1C1410', margin: 0 }}>Add photos</p>
          <p className="mt-0.5 font-cloud-body" style={{ fontSize: 11, color: '#8C7B6B', margin: 0 }}>
            {draggingOver ? "Drop to add" : "Tap to select · or drag & drop"}
          </p>
        </div>
      </div>

      {/* Upload queue */}
      {uploadFiles.length > 0 && (
        <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {uploadFiles.map((f) => (
            <div key={f.id} className="relative aspect-square overflow-hidden rounded-xl bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
              {f.status === "uploading" && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
                  <div className="h-full bg-[#D4FF4F] transition-all" style={{ width: `${f.progress}%` }} />
                </div>
              )}
              {f.status === "done" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
              {f.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                  <X className="h-5 w-5 text-red-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photo count bar */}
      {media.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase font-cloud-body">{media.length} photos</p>
          <p className="text-[11px] text-[#999990] font-cloud-body">drag to reorder</p>
        </div>
      )}

      {/* Photo grid with drag to reorder */}
      {media.length > 0 && (
        <DragDropContext onDragEnd={(r) => void handleDragEnd(r)}>
          <Droppable droppableId="photos" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
              >
                {media.map((m, idx) => (
                  <Draggable key={m.id} draggableId={m.id} index={idx}>
                    {(drag, snap) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        {...drag.dragHandleProps}
                        onClick={() => {
                          if (!snap.isDragging) {
                            setLightboxIdx(idx);
                            setCaptionDraft(m.caption ?? "");
                          }
                        }}
                        className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl bg-black/5 active:cursor-grabbing ${snap.isDragging ? "z-10 ring-2 ring-[#D4FF4F]" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.public_url}
                          alt={m.caption ?? `Photo ${idx + 1}`}
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100" />
                        {m.caption && (
                          <p className="pointer-events-none absolute bottom-2 left-2 right-2 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100 font-cloud-body">
                            {m.caption}
                          </p>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); void deleteMedia(m.id); }}
                          className="absolute right-1.5 top-1.5 rounded-full bg-white/80 p-1 text-[#666660] transition-opacity hover:text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Description — stats SectionCard */}
      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">About this project</h3>
          {!editingDesc && (
            <button
              onClick={() => setEditingDesc(true)}
              className="rounded p-0.5 text-[#999990] hover:text-[#0a0a0a] transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        {editingDesc ? (
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => void saveDesc()}
            autoFocus
            rows={4}
            placeholder="Describe this project — materials used, scope of work, etc."
            className="w-full resize-none rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
          />
        ) : (
          <p
            className="cursor-text text-[13px] text-[#666660] font-cloud-body"
            onClick={() => setEditingDesc(true)}
          >
            {project.description || (
              <span className="italic text-[#999990]">Add a description…</span>
            )}
          </p>
        )}
      </div>

      {/* Analytics teaser — activity SectionCard */}
      <div className="rounded-[20px] border border-[#C4A8FF]/30 bg-gradient-to-br from-[#F5F0FF] via-[#EDE5FF] to-[#DDD0FF] p-4 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50">
            <BarChart2 className="h-4 w-4 text-[#2D1B6B]" strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-cloud-display text-[14px] text-[#2D1B6B]">Analytics</p>
            <p className="text-[11px] text-[#7B5EA7] font-cloud-body">Track views and engagement</p>
          </div>
        </div>
        <Link
          href={`/cloud/dashboard/projects/${projectId}/analytics`}
          className="text-[12px] font-semibold text-[#2D1B6B] font-cloud-body hover:underline"
        >
          View →
        </Link>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && currentMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="h-5 w-5" />
          </button>

          <a
            href={currentMedia.public_url}
            download
            className="absolute right-14 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-5 w-5" />
          </a>

          <button
            className="absolute right-24 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-red-500/30"
            onClick={(e) => { e.stopPropagation(); void deleteMedia(currentMedia.id); }}
          >
            <Trash2 className="h-5 w-5" />
          </button>

          {lightboxIdx > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => i! - 1); setCaptionDraft(media[lightboxIdx - 1]?.caption ?? ""); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {lightboxIdx < media.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => i! + 1); setCaptionDraft(media[lightboxIdx + 1]?.caption ?? ""); }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentMedia.public_url}
            alt={currentMedia.caption ?? ""}
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <div
            className="absolute bottom-6 left-1/2 w-full max-w-md -translate-x-1/2 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              onBlur={() => void saveCaption(currentMedia.id, captionDraft)}
              placeholder="Add a caption…"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-center text-[13px] text-white placeholder-white/30 outline-none focus:border-[#D4FF4F] backdrop-blur-sm font-cloud-body"
            />
          </div>

          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-[12px] text-white/30 font-cloud-body">
            {lightboxIdx + 1} / {media.length}
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#0a0a0a]/90 px-5 py-2.5 text-[13px] text-white backdrop-blur-md font-cloud-body lg:bottom-8">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
