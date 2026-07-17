"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  ArrowLeft, BarChart2, Camera, Check, ChevronLeft, ChevronRight, Copy,
  Download, MoreVertical, Pencil, Play, Trash2, Video, X,
  MapPin, Calendar, LayoutGrid, GitBranch, Plus, CheckCircle2,
  XCircle, Paperclip, Trophy, BookOpen, Quote, ListOrdered, SlidersHorizontal, Star, RefreshCw,
} from "lucide-react";
import { generateVideoThumbnail, formatDuration } from "@/app/cloud/lib/video-thumbnail";
import { MilestoneForm } from "@/app/cloud/components/MilestoneForm";
import { MediaAttachPicker } from "@/app/cloud/components/MediaAttachPicker";
import Link from "next/link";
import { getProjectCardStyles } from "@/app/cloud/components/ProjectCard";
import { uploadProjectMediaFile, uploadErrorMessage } from "@/app/cloud/lib/upload-project-media";
import { buildProjectShareUrl } from "@/app/cloud/lib/project-share-url";

type MediaItem = {
  id: string;
  public_url: string;
  storage_key: string;
  display_order: number;
  caption: string | null;
  type?: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  milestone_id?: string | null;
};

type MilestoneMedia = {
  id: string;
  public_url: string;
  caption?: string | null;
  display_order: number;
  milestone_id?: string | null;
};

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  milestone_date: string;
  display_order: number;
  is_completed: boolean;
  created_at: string;
  stat_number?: string | null;
  stat_label?: string | null;
  phase?: string | null;
  project_media: MilestoneMedia[];
};

type TimelineStepDraft = { day_label: string; title: string; description: string; media_ids: string[] };
type SpecFieldDraft = { label: string; value: string };

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
  duration_label?: string | null;
  budget_range?: string | null;
  show_budget?: boolean;
  cover_media_id?: string | null;
  story_brief?: string | null;
  story_result?: string | null;
  pull_quote?: string | null;
  pull_quote_by?: string | null;
  timeline_steps?: TimelineStepDraft[];
  spec_fields?: SpecFieldDraft[];
  include_capability_section?: boolean;
  pdf_url?: string | null;
  pdf_generated_at?: string | null;
  project_media: MediaItem[];
};

type UploadFile = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  fileType: "photo" | "video";
  thumbnailBlob?: Blob;
  duration?: number;
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

  const [activeTab, setActiveTab] = useState<"gallery" | "timeline">("gallery");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState<string | null>(null);
  const [openMilestoneMenu, setOpenMilestoneMenu] = useState<string | null>(null);

  const [durationLabel, setDurationLabel] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [showBudget, setShowBudget] = useState(false);

  const [storyBrief, setStoryBrief] = useState("");
  const [storyResult, setStoryResult] = useState("");
  const [pullQuote, setPullQuote] = useState("");
  const [pullQuoteBy, setPullQuoteBy] = useState("");
  const [timelineSteps, setTimelineSteps] = useState<TimelineStepDraft[]>([]);
  const [specFields, setSpecFields] = useState<SpecFieldDraft[]>([]);
  const [includeCapabilitySection, setIncludeCapabilitySection] = useState(false);
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [pdfRegenerating, setPdfRegenerating] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

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
      setDurationLabel(found.duration_label ?? "");
      setBudgetRange(found.budget_range ?? "");
      setShowBudget(found.show_budget ?? false);
      setStoryBrief(found.story_brief ?? "");
      setStoryResult(found.story_result ?? "");
      setPullQuote(found.pull_quote ?? "");
      setPullQuoteBy(found.pull_quote_by ?? "");
      setTimelineSteps(
        Array.isArray(found.timeline_steps)
          ? found.timeline_steps.map((s) => ({
              day_label: s.day_label ?? "",
              title: s.title ?? "",
              description: s.description ?? "",
              media_ids: Array.isArray(s.media_ids)
                ? s.media_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
                : [],
            }))
          : []
      );
      setSpecFields(
        Array.isArray(found.spec_fields)
          ? found.spec_fields.map((s) => ({
              label: s.label ?? "",
              value: s.value ?? "",
            }))
          : []
      );
      setCoverMediaId(found.cover_media_id ?? null);
      setIncludeCapabilitySection(Boolean(found.include_capability_section));
      const sorted = [...(found.project_media ?? [])].sort((a, b) => a.display_order - b.display_order);
      setMedia(sorted);
    } finally {
      setLoading(false);
    }
  }, [session?.clientId, projectId, router]);

  useEffect(() => { void fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (!session?.clientId) return;
    fetch(`/api/clients/${session.clientId}/profile`)
      .then((r) => r.json())
      .then((data: { slug?: string | null; is_published?: boolean | null }) => {
        if (data?.slug && data.is_published) setProfileSlug(data.slug);
      })
      .catch(() => {});
  }, [session?.clientId]);

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

  function toggleTimelineStepPhoto(stepIndex: number, mediaId: string) {
    setTimelineSteps((prev) =>
      prev.map((row, i) => {
        if (i !== stepIndex) return row;
        const current = row.media_ids ?? [];
        const next = current.includes(mediaId)
          ? current.filter((id) => id !== mediaId)
          : [...current, mediaId];
        return { ...row, media_ids: next };
      })
    );
  }

  const galleryPhotoItems = media.filter((m) => m.type !== "video" && m.type !== "video_url");

  async function saveMagazineFields() {
    if (!project || !session?.clientId) return;
    const cleanedTimeline = timelineSteps
      .map((s) => ({
        day_label: s.day_label.trim(),
        title: s.title.trim(),
        description: s.description.trim(),
        media_ids: (s.media_ids ?? []).filter(Boolean),
      }))
      .filter((s) => s.day_label || s.title || s.description || s.media_ids.length > 0);
    const cleanedSpecs = specFields
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label || s.value);

    await fetch(`/api/clients/${session.clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story_brief: storyBrief.trim() || null,
        story_result: storyResult.trim() || null,
        pull_quote: pullQuote.trim() || null,
        pull_quote_by: pullQuoteBy.trim() || null,
        timeline_steps: cleanedTimeline,
        spec_fields: cleanedSpecs,
        include_capability_section: includeCapabilitySection,
      }),
    });
    setProject((p) =>
      p
        ? {
            ...p,
            story_brief: storyBrief.trim() || null,
            story_result: storyResult.trim() || null,
            pull_quote: pullQuote.trim() || null,
            pull_quote_by: pullQuoteBy.trim() || null,
            timeline_steps: cleanedTimeline,
            spec_fields: cleanedSpecs,
            include_capability_section: includeCapabilitySection,
          }
        : p
    );
    showToast("Magazine content saved");
  }

  async function setCoverPhoto(mediaId: string) {
    if (!project || !session?.clientId) return;
    const nextId = coverMediaId === mediaId ? null : mediaId;
    await fetch(`/api/clients/${session.clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_media_id: nextId }),
    });
    setCoverMediaId(nextId);
    setProject((p) => (p ? { ...p, cover_media_id: nextId } : p));
    showToast(nextId ? "Cover photo set" : "Cover photo cleared");
  }

  async function saveProjectInfo() {
    if (!project || !session?.clientId) return;
    await fetch(`/api/clients/${session.clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration_label: durationLabel.trim() || null,
        budget_range: budgetRange.trim() || null,
        show_budget: showBudget,
      }),
    });
    setProject((p) => p ? { ...p, duration_label: durationLabel.trim() || null, budget_range: budgetRange.trim() || null, show_budget: showBudget } : p);
    showToast("Project info saved");
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
    const url = buildProjectShareUrl(window.location.origin, project!.id, profileSlug);
    void navigator.clipboard.writeText(url);
    showToast("Case study link copied!");
    setMenuOpen(false);
  }

  async function regeneratePdf() {
    if (!project || !session?.clientId || pdfRegenerating) return;
    if (!project.is_public) {
      showToast("Make this project public first.");
      return;
    }
    if (!profileSlug) {
      showToast("Publish your public profile first.");
      return;
    }

    setPdfRegenerating(true);
    try {
      const res = await fetch(
        `/api/clients/${session.clientId}/projects/${project.id}/pdf`,
        { method: "POST" }
      );
      const raw = await res.text();
      let data: {
        pdf_url?: string;
        pdf_generated_at?: string;
        error?: string;
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        data = {};
      }
      if (!res.ok || !data.pdf_url) {
        showToast(data.error ?? (res.status === 504 ? "PDF timed out — try again in a moment." : "PDF generation failed"));
        return;
      }
      setProject((p) =>
        p
          ? {
              ...p,
              pdf_url: data.pdf_url ?? null,
              pdf_generated_at: data.pdf_generated_at ?? null,
            }
          : p
      );
      showToast("PDF regenerated successfully.");
    } catch {
      showToast("PDF generation failed");
    } finally {
      setPdfRegenerating(false);
    }
  }

  async function addFilesAsync(files: File[]) {
    const validFiles = files.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );

    const newItems: UploadFile[] = [];
    for (const file of validFiles) {
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(
          isVideo
            ? `${file.name} is too large. Videos must be under 200MB.`
            : `${file.name} is too large. Photos must be under 20MB.`
        );
        continue;
      }

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

      newItems.push({
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

    setUploadFiles((prev) => [...prev, ...newItems]);
    void uploadAll(newItems);
  }

  async function uploadSingle(item: UploadFile): Promise<void> {
    if (!session?.clientId) return;
    const isVideo = item.fileType === "video";
    setUploadFiles((prev) =>
      prev.map((f) => f.id === item.id ? { ...f, status: "uploading" } : f)
    );
    try {
      const { key, publicUrl } = await uploadProjectMediaFile(
        item.file,
        session.clientId,
        projectId
      );

      let thumbnailUrl: string | undefined;
      if (isVideo && item.thumbnailBlob) {
        try {
          const thumbFile = new File([item.thumbnailBlob], `thumb_${item.file.name}.jpg`, {
            type: "image/jpeg",
          });
          const thumb = await uploadProjectMediaFile(thumbFile, session.clientId, projectId);
          thumbnailUrl = thumb.publicUrl;
        } catch (err) {
          console.warn("Thumbnail upload failed:", err);
        }
      }

      const mediaRes = await fetch(
        `/api/clients/${session.clientId}/projects/${projectId}/media`,
        {
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
        }
      );
      const newMediaItem = (await mediaRes.json()) as MediaItem;

      if (!isVideo) {
        const wmRes = await fetch("/api/cloud/watermark/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: newMediaItem.id, originalKey: key, clientId: session.clientId }),
        });
        const wmData = (await wmRes.json()) as { publicUrl: string };
        setMedia((prev) => [...prev, { ...newMediaItem, public_url: wmData.publicUrl, display_order: prev.length }]);
      } else {
        setMedia((prev) => [...prev, { ...newMediaItem, display_order: prev.length }]);
      }

      setUploadFiles((prev) =>
        prev.map((f) => f.id === item.id ? { ...f, status: "done", progress: 100 } : f)
      );
    } catch (err) {
      showToast(uploadErrorMessage(err));
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

  async function fetchMilestones() {
    if (!session?.clientId) return;
    setMilestonesLoading(true);
    try {
      const res = await fetch(`/api/clients/${session.clientId}/projects/${projectId}/milestones`);
      const body = (await res.json()) as { milestones: Milestone[] };
      setMilestones(body.milestones ?? []);
    } finally {
      setMilestonesLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === "timeline") { void fetchMilestones(); } }, [activeTab]);

  async function createMilestone(data: { title: string; description: string; milestone_date: string; stat_number?: string | null; stat_label?: string | null; phase?: string | null }) {
    if (!session?.clientId) return;
    const res = await fetch(`/api/clients/${session.clientId}/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create milestone");
    await fetchMilestones();
  }

  async function updateMilestone(
    milestoneId: string,
    data: { title?: string; description?: string; milestone_date?: string; is_completed?: boolean; stat_number?: string | null; stat_label?: string | null; phase?: string | null }
  ) {
    if (!session?.clientId) return;
    const res = await fetch(
      `/api/clients/${session.clientId}/projects/${projectId}/milestones/${milestoneId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
    );
    if (!res.ok) throw new Error("Failed to update milestone");
    await fetchMilestones();
  }

  async function deleteMilestone(milestoneId: string) {
    if (!confirm("Delete this milestone? Photos will remain in the project.")) return;
    if (!session?.clientId) return;
    await fetch(
      `/api/clients/${session.clientId}/projects/${projectId}/milestones/${milestoneId}`,
      { method: "DELETE" }
    );
    await fetchMilestones();
  }

  async function toggleMilestoneComplete(milestone: Milestone) {
    await updateMilestone(milestone.id, { is_completed: !milestone.is_completed });
    setOpenMilestoneMenu(null);
  }

  async function attachMediaToMilestone(milestoneId: string, mediaIds: string[]) {
    if (!session?.clientId) return;
    const res = await fetch(
      `/api/clients/${session.clientId}/projects/${projectId}/milestones/${milestoneId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds }),
      }
    );
    if (!res.ok) throw new Error("Failed to attach photos");
    await fetchMilestones();
    void fetchProject();
  }

  function formatMilestoneDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
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
  const galleryPhotos = media.filter((m) => m.type !== "video");
  const photoDownloadUrl = (mediaId: string) =>
    `/api/clients/${session?.clientId}/projects/${projectId}/media/${mediaId}/download`;
  const allPhotosDownloadUrl = session?.clientId
    ? `/api/clients/${session.clientId}/projects/${projectId}/media/download`
    : null;

  async function downloadAllPhotos() {
    if (!allPhotosDownloadUrl || !project) return;
    setDownloadingAll(true);
    try {
      const res = await fetch(allPhotosDownloadUrl);
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.title.replace(/[^\w\s.-]/g, "").trim() || "project"}-photos.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not download photos.");
    } finally {
      setDownloadingAll(false);
    }
  }

  const catStyles = project ? getProjectCardStyles(project.category) : null;

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/cloud/dashboard/projects"
            className="mb-3 flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#0a0a0a] transition-colors font-cloud-body lg:hidden"
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
              <Pencil className="h-3.5 w-3.5 text-[#6B7280] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {project.category && catStyles && (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-cloud-body ${catStyles.badge}`}>
                {project.category}
              </span>
            )}
            {project.location && (
              <span className="flex items-center gap-1 text-[12px] text-[#6B7280] font-cloud-body">
                <MapPin className="h-3 w-3" />{project.location}
              </span>
            )}
            {project.completion_date && (
              <span className="flex items-center gap-1 text-[12px] text-[#6B7280] font-cloud-body">
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

      {/* Gallery / Timeline tab switcher */}
      <div style={{ display: "flex", marginBottom: 16, background: "#F7F4EF", borderRadius: 12, padding: 3 }}>
        {(["gallery", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, height: 36,
              background: activeTab === tab ? "#FFFFFF" : "transparent",
              border: "none", borderRadius: 10,
              fontSize: 12, fontWeight: 700,
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              color: activeTab === tab ? "#1C1410" : "#8C7B6B",
              cursor: "pointer",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(28,20,16,0.08)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              textTransform: "capitalize", transition: "all 0.15s ease",
            }}
          >
            {tab === "gallery" ? <LayoutGrid size={13} /> : <GitBranch size={13} />}
            {tab}
            {tab === "timeline" && milestones.length > 0 && (
              <span style={{ background: "#1C1410", color: "#D4FF4F", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>
                {milestones.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Upload zone — mint SectionCard */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingOver(false);
          void addFilesAsync(Array.from(e.dataTransfer.files));
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
          accept="image/*,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/3gpp"
          multiple
          className="hidden"
          onChange={(e) => { void addFilesAsync(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
        <div className="flex flex-col items-center justify-center py-3 px-5">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/70" style={{ boxShadow: 'var(--cloud-shadow-card)' }}>
            <Camera className={`h-5 w-5 ${draggingOver ? "text-[#00875A]" : "text-[#00875A]"}`} strokeWidth={1.8} />
          </div>
          <p className="font-cloud-display" style={{ fontSize: 15, color: '#1C1410', margin: 0 }}>Add photos or videos</p>
          <p className="mt-0.5 font-cloud-body" style={{ fontSize: 11, color: '#8C7B6B', margin: 0 }}>
            {draggingOver ? "Drop to add" : "Photos up to 20MB · Videos up to 200MB"}
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

      {/* Photo count bar — gallery tab only */}
      {activeTab === "gallery" && media.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#6B7280] uppercase font-cloud-body">
            {media.length} {media.some(m => m.type === "video") ? "items" : "photos"}
          </p>
          <div className="flex items-center gap-2">
            {galleryPhotos.length > 0 && (
              <button
                type="button"
                onClick={() => downloadAllPhotos()}
                disabled={downloadingAll}
                className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4A3828] transition-colors hover:bg-[#F5F5F0] disabled:opacity-60 font-cloud-body"
              >
                <Download className="h-3.5 w-3.5" />
                {downloadingAll ? "Preparing…" : "Download all for social"}
              </button>
            )}
            <p className="text-[11px] text-[#6B7280] font-cloud-body">drag to reorder</p>
          </div>
        </div>
      )}

      {/* Photo grid with drag to reorder — gallery tab only */}
      {activeTab === "gallery" && media.length > 0 && (
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
                        {m.type === "video" ? (
                          <>
                            {m.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.thumbnail_url}
                                alt={m.caption ?? "Video"}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center" style={{ background: "#2E2218" }}>
                                <Video className="h-7 w-7" style={{ color: "rgba(255,255,255,0.3)" }} />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(28,20,16,0.35)" }}>
                              <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.9)" }}>
                                <Play style={{ fill: "#1C1410", color: "#1C1410", width: 16, height: 16, marginLeft: 2 }} />
                              </div>
                            </div>
                            {m.duration_seconds ? (
                              <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.7)", color: "#FFFFFF", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>
                                {formatDuration(m.duration_seconds)}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.public_url}
                              alt={m.caption ?? `Photo ${idx + 1}`}
                              loading={idx === 0 ? 'eager' : 'lazy'}
                              decoding="async"
                              className="h-full w-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = photoDownloadUrl(m.id);
                              }}
                              className="absolute bottom-1.5 right-1.5 rounded-full bg-white/85 p-1.5 text-[#666660] transition-opacity hover:text-[#0a0a0a] opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              aria-label="Download watermarked photo"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void setCoverPhoto(m.id); }}
                              className={`absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition-opacity ${
                                coverMediaId === m.id
                                  ? "bg-[#D4FF4F] text-[#0a0a0a] opacity-100"
                                  : "bg-white/85 text-[#666660] opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              }`}
                            >
                              <Star className={`h-3 w-3 ${coverMediaId === m.id ? "fill-current" : ""}`} />
                              {coverMediaId === m.id ? "Cover" : "Set cover"}
                            </button>
                          </>
                        )}
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

      {/* ── TIMELINE TAB ── */}
      {activeTab === "timeline" && (
        <div style={{ marginBottom: 20 }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: 0 }}>
              Milestones
            </p>
            <button
              onClick={() => setShowMilestoneForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", background: "#1C1410", color: "#D4FF4F", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: "var(--fw-font-body), system-ui, sans-serif", cursor: "pointer" }}
            >
              <Plus size={13} />
              Add milestone
            </button>
          </div>

          {/* Progress summary */}
          {milestones.length > 0 && (
            <div style={{ background: "#F7F4EF", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, color: "#4A3828", fontWeight: 600 }}>
                    {milestones.filter((m) => m.is_completed).length} of {milestones.length} complete
                  </span>
                  <span style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, color: "#8C7B6B" }}>
                    {Math.round((milestones.filter((m) => m.is_completed).length / milestones.length) * 100)}%
                  </span>
                </div>
                <div style={{ height: 6, background: "rgba(28,20,16,0.1)", borderRadius: 3 }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: milestones.every((m) => m.is_completed) ? "#D4FF4F" : "#1C1410",
                    width: `${Math.round((milestones.filter((m) => m.is_completed).length / milestones.length) * 100)}%`,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
              {milestones.every((m) => m.is_completed) && (
                <Trophy size={22} color="#1C1410" />
              )}
            </div>
          )}

          {/* Loading skeleton */}
          {milestonesLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 80, borderRadius: 14, background: "linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.5s infinite", animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!milestonesLoading && milestones.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "#F7F4EF", borderRadius: 18, border: "1.5px dashed rgba(28,20,16,0.14)" }}>
              <GitBranch size={32} color="#6B7280" style={{ display: "block", margin: "0 auto 12px" }} />
              <p style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 18, color: "#1C1410", margin: "0 0 6px" }}>No milestones yet</p>
              <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 12, color: "#8C7B6B", margin: "0 0 20px" }}>
                Track your project progress by adding key stages
              </p>
              <button
                onClick={() => setShowMilestoneForm(true)}
                style={{ height: 44, padding: "0 20px", background: "#1C1410", color: "#D4FF4F", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "var(--fw-font-body), system-ui, sans-serif", cursor: "pointer" }}
              >
                Add first milestone
              </button>
            </div>
          )}

          {/* Milestone cards */}
          {!milestonesLoading && milestones.map((milestone, idx) => (
            <div key={milestone.id} style={{ marginBottom: 12, position: "relative" }}>
              {/* Vertical connector line */}
              {idx < milestones.length - 1 && (
                <div style={{ position: "absolute", left: 18, top: 40, bottom: -12, width: 2, background: milestone.is_completed ? "rgba(28,20,16,0.15)" : "rgba(28,20,16,0.07)", zIndex: 0 }} />
              )}

              <div style={{ background: "#FFFFFF", borderRadius: 16, border: `0.5px solid ${milestone.is_completed ? "rgba(28,20,16,0.12)" : "rgba(28,20,16,0.07)"}`, overflow: "hidden", position: "relative", zIndex: 1 }}>
                {/* Card header */}
                <div style={{ padding: "14px 14px 12px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Status indicator */}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: milestone.is_completed ? "#1C1410" : "#F7F4EF", border: `1.5px solid ${milestone.is_completed ? "#1C1410" : "rgba(28,20,16,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    {milestone.is_completed
                      ? <CheckCircle2 size={16} color="#D4FF4F" />
                      : <span style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: "#8C7B6B" }}>{String(idx + 1).padStart(2, "0")}</span>
                    }
                  </div>

                  {/* Title + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 2 }}>
                      <p style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 15, color: milestone.is_completed ? "#8C7B6B" : "#1C1410", margin: 0, textDecoration: milestone.is_completed ? "line-through" : "none" }}>
                        {milestone.title}
                      </p>
                      {milestone.phase && (
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          height: 20, padding: "0 8px",
                          background: milestone.phase === "before" ? "rgba(232,96,44,0.1)" : milestone.phase === "during" ? "rgba(196,154,60,0.1)" : "rgba(46,125,94,0.1)",
                          color: milestone.phase === "before" ? "#E8602C" : milestone.phase === "during" ? "#C49A3C" : "#2E7D5E",
                          borderRadius: 20, fontSize: 9, fontWeight: 700,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                        }}>
                          {milestone.phase}
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, color: "#8C7B6B", margin: 0 }}>
                      {formatMilestoneDate(milestone.milestone_date)}
                    </p>
                    {milestone.description && (
                      <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 12, color: "#4A3828", margin: "6px 0 0", lineHeight: 1.5 }}>
                        {milestone.description}
                      </p>
                    )}
                    {(milestone.stat_number || milestone.stat_label) && (
                      <div style={{
                        display: "inline-flex", alignItems: "baseline", gap: 5,
                        marginTop: 6, padding: "4px 10px",
                        background: "#F7F4EF", borderRadius: 20, width: "fit-content",
                      }}>
                        {milestone.stat_number && (
                          <span style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 16, fontWeight: 400, color: "#1C1410" }}>
                            {milestone.stat_number}
                          </span>
                        )}
                        {milestone.stat_label && (
                          <span style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, color: "#8C7B6B" }}>
                            {milestone.stat_label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Menu */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      onClick={() => setOpenMilestoneMenu(openMilestoneMenu === milestone.id ? null : milestone.id)}
                      style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#8C7B6B" }}
                    >
                      <MoreVertical size={15} />
                    </button>
                    {openMilestoneMenu === milestone.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMilestoneMenu(null)} />
                        <div style={{ position: "absolute", right: 0, top: 32, zIndex: 20, background: "#FFFFFF", borderRadius: 12, border: "0.5px solid rgba(28,20,16,0.12)", padding: "6px 0", minWidth: 168, boxShadow: "0 4px 16px rgba(28,20,16,0.12)" }}>
                          <button
                            onClick={() => { void toggleMilestoneComplete(milestone); }}
                            style={{ width: "100%", padding: "8px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", display: "flex", alignItems: "center", gap: 8 }}
                          >
                            {milestone.is_completed ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                            {milestone.is_completed ? "Mark incomplete" : "Mark complete"}
                          </button>
                          <button
                            onClick={() => { setEditingMilestone(milestone); setOpenMilestoneMenu(null); }}
                            style={{ width: "100%", padding: "8px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => { void deleteMilestone(milestone.id); setOpenMilestoneMenu(null); }}
                            style={{ width: "100%", padding: "8px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#E8602C", fontFamily: "var(--fw-font-body), system-ui, sans-serif", display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Photo strip */}
                {milestone.project_media && milestone.project_media.length > 0 && (
                  <div style={{ padding: "0 14px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
                    {[...milestone.project_media].sort((a, b) => a.display_order - b.display_order).slice(0, 6).map((pm) => (
                      <div key={pm.id} style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pm.public_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                    {milestone.project_media.length > 6 && (
                      <div style={{ width: 64, height: 64, borderRadius: 10, background: "#F7F4EF", border: "0.5px solid rgba(28,20,16,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: "#4A3828" }}>
                          +{milestone.project_media.length - 6}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Attach photos button */}
                <div style={{ padding: "0 14px 14px" }}>
                  <button
                    onClick={() => setShowMediaPicker(milestone.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", background: "#F7F4EF", border: "0.5px solid rgba(28,20,16,0.1)", borderRadius: 10, fontSize: 11, fontWeight: 600, fontFamily: "var(--fw-font-body), system-ui, sans-serif", color: "#4A3828", cursor: "pointer" }}
                  >
                    <Paperclip size={12} />
                    {milestone.project_media && milestone.project_media.length > 0
                      ? `${milestone.project_media.length} photo${milestone.project_media.length !== 1 ? "s" : ""} · Add more`
                      : "Attach photos"
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Magazine story & specs */}
      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#666660]" />
            <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">
              Magazine story
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void saveMagazineFields()}
            className="rounded-lg bg-[#1C1410] px-3 py-1.5 text-[11px] font-bold text-[#D4FF4F] font-cloud-body"
          >
            Save story
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-semibold text-[#4A3828] font-cloud-body">Brief</label>
          <textarea
            value={storyBrief}
            onChange={(e) => setStoryBrief(e.target.value)}
            rows={4}
            placeholder="How the project started — context, goals, constraints…"
            className="w-full resize-none rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none focus:border-black/[0.2] font-cloud-body"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-semibold text-[#4A3828] font-cloud-body">Result</label>
          <textarea
            value={storyResult}
            onChange={(e) => setStoryResult(e.target.value)}
            rows={4}
            placeholder="Outcome, performance, client impact…"
            className="w-full resize-none rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none focus:border-black/[0.2] font-cloud-body"
          />
        </div>

        <div className="mb-1 flex items-center gap-2">
          <Quote className="h-3.5 w-3.5 text-[#666660]" />
          <p className="text-[11px] font-semibold text-[#4A3828] font-cloud-body">Pull quote</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={pullQuote}
            onChange={(e) => setPullQuote(e.target.value)}
            placeholder="Quote text"
            className="h-10 rounded-xl border border-black/[0.1] bg-white/70 px-3 text-[13px] text-[#0a0a0a] outline-none font-cloud-body"
          />
          <input
            value={pullQuoteBy}
            onChange={(e) => setPullQuoteBy(e.target.value)}
            placeholder="Quote author"
            className="h-10 rounded-xl border border-black/[0.1] bg-white/70 px-3 text-[13px] text-[#0a0a0a] outline-none font-cloud-body"
          />
        </div>
      </div>

      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-[#666660]" />
            <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">
              Timeline steps
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setTimelineSteps((prev) => [...prev, { day_label: "", title: "", description: "", media_ids: [] }])}
            className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4A3828] font-cloud-body"
          >
            <Plus className="h-3 w-3" />
            Add row
          </button>
        </div>
        {timelineSteps.length === 0 ? (
          <p className="text-[12px] italic text-[#6B7280] font-cloud-body">No timeline steps yet.</p>
        ) : (
          <div className="space-y-3">
            {timelineSteps.map((step, index) => (
              <div key={index} className="rounded-xl border border-black/[0.08] bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[#8C7B6B] font-cloud-body">Step {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => setTimelineSteps((prev) => prev.filter((_, i) => i !== index))}
                    className="text-[#6B7280] hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={step.day_label}
                    onChange={(e) =>
                      setTimelineSteps((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, day_label: e.target.value } : row))
                      )
                    }
                    placeholder="Day label (e.g. Day 1)"
                    className="h-9 rounded-lg border border-black/[0.08] bg-white/70 px-3 text-[12px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none font-cloud-body"
                  />
                  <input
                    value={step.title}
                    onChange={(e) =>
                      setTimelineSteps((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, title: e.target.value } : row))
                      )
                    }
                    placeholder="Title"
                    className="h-9 rounded-lg border border-black/[0.08] bg-white/70 px-3 text-[12px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none font-cloud-body"
                  />
                </div>
                <textarea
                  value={step.description}
                  onChange={(e) =>
                    setTimelineSteps((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row))
                    )
                  }
                  rows={2}
                  placeholder="Description"
                  className="mt-2 w-full resize-none rounded-lg border border-black/[0.08] bg-white/70 px-3 py-2 text-[12px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none font-cloud-body"
                />
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280] font-cloud-body">
                    Photos for this step
                  </p>
                  {galleryPhotoItems.length === 0 ? (
                    <p className="text-[11px] italic text-[#6B7280] font-cloud-body">
                      Upload photos to the gallery first, then attach them here.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {galleryPhotoItems.map((photo) => {
                        const selected = step.media_ids?.includes(photo.id) ?? false;
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => toggleTimelineStepPhoto(index, photo.id)}
                            className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 transition-colors ${
                              selected
                                ? "border-[#D4FF4F] ring-2 ring-[#D4FF4F]/35"
                                : "border-black/[0.08] hover:border-black/[0.18]"
                            }`}
                            aria-label={selected ? "Remove photo from step" : "Add photo to step"}
                            aria-pressed={selected}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.thumbnail_url ?? photo.public_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {selected && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                                <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {(step.media_ids?.length ?? 0) > 0 && (
                    <p className="mt-2 text-[11px] text-[#6B7280] font-cloud-body">
                      {step.media_ids!.length} photo{step.media_ids!.length === 1 ? "" : "s"} selected
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void saveMagazineFields()}
          className="mt-4 rounded-lg bg-[#1C1410] px-3 py-1.5 text-[11px] font-bold text-[#D4FF4F] font-cloud-body"
        >
          Save timeline
        </button>
      </div>

      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#666660]" />
            <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">
              Spec fields
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setSpecFields((prev) => [...prev, { label: "", value: "" }])}
            className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4A3828] font-cloud-body"
          >
            <Plus className="h-3 w-3" />
            Add row
          </button>
        </div>
        {specFields.length === 0 ? (
          <p className="text-[12px] italic text-[#6B7280] font-cloud-body">No spec fields yet.</p>
        ) : (
          <div className="space-y-2">
            {specFields.map((field, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={field.label}
                  onChange={(e) =>
                    setSpecFields((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, label: e.target.value } : row))
                    )
                  }
                  placeholder="Label"
                  className="h-9 flex-1 rounded-lg border border-black/[0.08] bg-white/70 px-3 text-[12px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none font-cloud-body"
                />
                <input
                  value={field.value}
                  onChange={(e) =>
                    setSpecFields((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, value: e.target.value } : row))
                    )
                  }
                  placeholder="Value"
                  className="h-9 flex-1 rounded-lg border border-black/[0.08] bg-white/70 px-3 text-[12px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none font-cloud-body"
                />
                <button
                  type="button"
                  onClick={() => setSpecFields((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-lg p-2 text-[#6B7280] hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void saveMagazineFields()}
          className="mt-4 rounded-lg bg-[#1C1410] px-3 py-1.5 text-[11px] font-bold text-[#D4FF4F] font-cloud-body"
        >
          Save specs
        </button>
      </div>

      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#666660]" />
          <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">
            Company capability
          </h3>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.08] bg-white/70 px-4 py-3">
          <input
            type="checkbox"
            checked={includeCapabilitySection}
            onChange={(e) => setIncludeCapabilitySection(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1C1410]"
          />
          <span>
            <span className="block text-[13px] font-semibold text-[#0a0a0a] font-cloud-body">
              Include company capability section on this project&apos;s magazine
            </span>
            <span className="mt-1 block text-[12px] leading-relaxed text-[#6B7280] font-cloud-body">
              Shows your company profile from Settings on the public page and PDF. Edit capability
              details under Settings → Company capability.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => void saveMagazineFields()}
          className="mt-4 rounded-lg bg-[#1C1410] px-3 py-1.5 text-[11px] font-bold text-[#D4FF4F] font-cloud-body"
        >
          Save magazine options
        </button>
      </div>

      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[#666660]" />
            <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">
              PDF case study
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void regeneratePdf()}
            disabled={pdfRegenerating || !project.is_public || !profileSlug}
            className="flex items-center gap-1.5 rounded-lg bg-[#1C1410] px-3 py-1.5 text-[11px] font-bold text-[#D4FF4F] font-cloud-body disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pdfRegenerating ? "animate-spin" : ""}`} />
            {pdfRegenerating ? "Generating…" : "Regenerate PDF"}
          </button>
        </div>
        <p className="text-[12px] text-[#666660] font-cloud-body">
          Use this after updating photos, story, or layout changes. Public downloads use the latest generated file.
        </p>
        {project.pdf_generated_at ? (
          <p className="mt-2 text-[11px] text-[#8C7B6B] font-cloud-body">
            Last generated{" "}
            {new Date(project.pdf_generated_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : (
          <p className="mt-2 text-[11px] italic text-[#6B7280] font-cloud-body">
            No PDF generated yet.
          </p>
        )}
        {project.pdf_url ? (
          <a
            href={project.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4A3828] underline font-cloud-body"
          >
            <Download className="h-3.5 w-3.5" />
            Preview latest PDF
          </a>
        ) : null}
        {(!project.is_public || !profileSlug) && (
          <p className="mt-2 text-[11px] text-[#6B7280] font-cloud-body">
            Requires a public project and published profile.
          </p>
        )}
      </div>

      {/* Description — stats SectionCard */}
      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">About this project</h3>
          {!editingDesc && (
            <button
              onClick={() => setEditingDesc(true)}
              className="rounded p-0.5 text-[#6B7280] hover:text-[#0a0a0a] transition-colors"
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
            className="w-full resize-none rounded-xl border border-black/[0.1] bg-white/70 px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none focus:border-black/[0.2] font-cloud-body"
          />
        ) : (
          <p
            className="cursor-text text-[13px] text-[#666660] font-cloud-body"
            onClick={() => setEditingDesc(true)}
          >
            {project.description || (
              <span className="italic text-[#6B7280]">Add a description…</span>
            )}
          </p>
        )}
      </div>

      {/* Project info — duration & budget */}
      <div className="rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 mb-4">
        <h3 className="mb-3 font-cloud-body text-[10px] font-bold tracking-[0.08em] text-[#666660] uppercase">Project info</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, fontWeight: 600, color: "#4A3828", marginBottom: 4 }}>
            Duration <span style={{ fontWeight: 400, color: "#8C7B6B" }}>(optional)</span>
          </label>
          <input
            value={durationLabel}
            onChange={(e) => setDurationLabel(e.target.value)}
            onBlur={() => void saveProjectInfo()}
            placeholder="e.g. 6 months, 3 weeks, 45 days"
            style={{ width: "100%", height: 40, padding: "0 12px", background: "rgba(255,255,255,0.7)", border: "0.5px solid rgba(28,20,16,0.1)", borderRadius: 10, fontSize: 13, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, fontWeight: 600, color: "#4A3828", marginBottom: 4 }}>
            Budget range <span style={{ fontWeight: 400, color: "#8C7B6B" }}>(optional)</span>
          </label>
          <input
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            onBlur={() => void saveProjectInfo()}
            placeholder="e.g. $15,000 – $20,000"
            style={{ width: "100%", height: 40, padding: "0 12px", background: "rgba(255,255,255,0.7)", border: "0.5px solid rgba(28,20,16,0.1)", borderRadius: 10, fontSize: 13, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,0.5)", borderRadius: 10 }}>
          <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 12, color: "#4A3828", margin: 0 }}>Show budget on public page</p>
          <input
            type="checkbox"
            checked={showBudget}
            onChange={(e) => { setShowBudget(e.target.checked); }}
            onBlur={() => void saveProjectInfo()}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
        </div>
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

      {/* MilestoneForm — create */}
      {showMilestoneForm && (
        <MilestoneForm
          projectCategory={project.category ?? "Other"}
          mode="create"
          existingMilestones={milestones}
          onSave={createMilestone}
          onClose={() => setShowMilestoneForm(false)}
        />
      )}

      {/* MilestoneForm — edit */}
      {editingMilestone && (
        <MilestoneForm
          projectCategory={project.category ?? "Other"}
          mode="edit"
          existingMilestones={milestones}
          initialData={{
            title: editingMilestone.title,
            description: editingMilestone.description ?? "",
            milestone_date: editingMilestone.milestone_date,
            stat_number: editingMilestone.stat_number ?? "",
            stat_label: editingMilestone.stat_label ?? "",
            phase: editingMilestone.phase ?? null,
          }}
          onSave={(data) => updateMilestone(editingMilestone.id, data)}
          onClose={() => setEditingMilestone(null)}
        />
      )}

      {/* MediaAttachPicker */}
      {showMediaPicker && (
        <MediaAttachPicker
          allMedia={media}
          currentMilestoneId={showMediaPicker}
          onAttach={(ids) => attachMediaToMilestone(showMediaPicker, ids)}
          onClose={() => setShowMediaPicker(null)}
        />
      )}

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

          {currentMedia.type !== "video" && (
            <a
              href={photoDownloadUrl(currentMedia.id)}
              className="absolute right-14 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => e.stopPropagation()}
              title="Download watermarked photo"
              aria-label="Download watermarked photo"
            >
              <Download className="h-5 w-5" />
            </a>
          )}

          <button
            className={`absolute top-4 rounded-full bg-white/10 p-2 text-white hover:bg-red-500/30 ${currentMedia.type === "video" ? "right-14" : "right-24"}`}
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

          {currentMedia.type === "video" ? (
            <video
              src={currentMedia.public_url}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 12 }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentMedia.public_url}
              alt={currentMedia.caption ?? ""}
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}

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
