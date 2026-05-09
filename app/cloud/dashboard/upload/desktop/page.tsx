"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Loader2, Plus, UploadCloud, X } from "lucide-react";

type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media: { id: string }[];
};

type DesktopFile = {
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

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputSt: React.CSSProperties = {
  borderRadius: 10,
  border: "0.5px solid rgba(28,20,16,0.15)",
  background: "#FFFFFF",
  padding: "10px 14px",
  fontSize: 13,
  fontFamily: "var(--fw-font-body), system-ui, sans-serif",
  outline: "none",
  color: "#1C1410",
};

export default function DesktopUploadPage() {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) return;
    fetch(`/api/clients/${session.clientId}/projects`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setProjects(
            (data as Project[]).sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
          );
        }
      })
      .catch(() => {});
  }, [session?.clientId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  function addFiles(rawFiles: File[]) {
    const imageFiles = rawFiles.filter(
      (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)
    );
    const items: DesktopFile[] = imageFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...items]);
    setAllDone(false);
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  async function createProject() {
    if (!newTitle.trim() || !session?.clientId) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`/api/clients/${session.clientId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory || null, is_public: true }),
      });
      const data = (await res.json()) as Project & { error?: string };
      if (!res.ok) { setCreateError(data.error ?? "Failed to create project."); return; }
      setProjects((prev) => [data, ...prev]);
      setSelectedProject(data);
      setShowNewProject(false);
      setNewTitle("");
      setNewCategory("");
    } catch {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function uploadSingleFile(item: DesktopFile): Promise<void> {
    if (!session?.clientId || !selectedProject) return;
    const clientId = session.clientId;
    const projectId = selectedProject.id;
    const fileId = item.id;

    setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: "uploading" } : f));

    try {
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type || "image/jpeg",
          clientId,
          projectId,
          purpose: "media",
        }),
      });
      if (!presignRes.ok) throw new Error("Presign failed");
      const { uploadUrl, key, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string; key: string; publicUrl: string;
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: pct } : f));
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            fetch(`/api/clients/${clientId}/projects/${projectId}/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ storage_key: key, public_url: publicUrl, file_size_bytes: item.file.size }),
            })
              .then((r) => r.json() as Promise<{ id: string }>)
              .then((savedMedia) => fetch("/api/cloud/watermark/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mediaId: savedMedia.id, originalKey: key, clientId }),
              }))
              .then(() => {
                setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: "done", progress: 100 } : f));
                setCompletedCount((c) => c + 1);
                resolve();
              })
              .catch(reject);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", item.file.type || "image/jpeg");
        xhr.send(item.file);
      });
    } catch {
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: "error" } : f));
    }
  }

  async function uploadAll() {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (!pending.length || !selectedProject) return;
    setUploading(true);
    setCompletedCount(0);

    const concurrency = 5;
    let index = 0;

    async function next(): Promise<void> {
      if (index >= pending.length) return;
      const item = pending[index++];
      await uploadSingleFile(item);
      return next();
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => next()));
    setUploading(false);
    setAllDone(true);
  }

  function resetForNewUpload() {
    setFiles([]);
    setAllDone(false);
    setCompletedCount(0);
  }

  if (isMobile === null) return null;

  if (isMobile) {
    return (
      <div style={{ padding: "48px 32px", textAlign: "center", fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#1C1410", marginBottom: 12 }}>
          Bulk upload works best on desktop.
        </p>
        <p style={{ fontSize: 14, color: "#8C7B6B", marginBottom: 24 }}>
          Use the mobile upload from your phone instead.
        </p>
        <a
          href="/cloud/dashboard/upload"
          style={{ fontSize: 14, color: "#1C1410", fontWeight: 600, textDecoration: "underline" }}
        >
          ← Go to mobile upload
        </a>
      </div>
    );
  }

  const totalCount = files.length;
  const totalSizeBytes = files.reduce((s, f) => s + f.file.size, 0);
  const doneCount = files.filter((f) => f.status === "done").length;

  if (allDone) {
    return (
      <div style={{
        minHeight: "100vh", background: "#F7F4EF",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--fw-font-body), system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center", padding: "48px 24px", maxWidth: 520 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "rgba(46,125,94,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          }}>
            <Check style={{ width: 28, height: 28, color: "#2E7D5E" }} />
          </div>
          <h2 style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 28, color: "#1C1410", margin: "0 0 8px" }}>
            {doneCount} photo{doneCount !== 1 ? "s" : ""} uploaded
          </h2>
          <p style={{ fontSize: 15, color: "#8C7B6B", margin: "0 0 32px" }}>
            All photos are saved to &ldquo;{selectedProject?.title}&rdquo; and backed up securely.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <a
              href={`/cloud/dashboard/projects/${selectedProject?.id}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                height: 44, padding: "0 24px", borderRadius: 12,
                background: "#1C1410", color: "#D4FF4F",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
              }}
            >
              View project
            </a>
            <button
              onClick={resetForNewUpload}
              style={{
                height: 44, padding: "0 24px", borderRadius: 12,
                border: "0.5px solid rgba(28,20,16,0.2)", background: "#FFFFFF",
                color: "#1C1410", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Upload more photos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EF", fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>
      {/* Sticky overall progress bar */}
      {uploading && (
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "#F7F4EF", borderBottom: "0.5px solid rgba(28,20,16,0.08)",
          padding: "12px 24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1C1410", fontFamily: "var(--fw-font-body)" }}>
              Uploading {completedCount} of {totalCount} photos
            </span>
            <span style={{ fontSize: 13, color: "#8C7B6B", fontFamily: "var(--fw-font-body)" }}>
              {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <div style={{ height: 4, background: "rgba(28,20,16,0.08)", borderRadius: 2 }}>
            <div style={{
              height: 4, background: "#1C1410", borderRadius: 2,
              width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <p style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 26, color: "#1C1410", margin: "0 0 4px" }}>
              Bulk Upload
            </p>
            <p style={{ fontSize: 13, color: "#8C7B6B", margin: 0 }}>
              Drop hundreds of photos at once · desktop only
            </p>
          </div>
          <a
            href="/cloud/dashboard/upload"
            style={{ fontSize: 13, color: "#8C7B6B", textDecoration: "none" }}
          >
            ← Mobile upload
          </a>
        </div>

        {/* Step 1 — Project selector */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8C7B6B", marginBottom: 10 }}>
            Step 1 — Select project
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={selectedProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((p) => p.id === e.target.value) ?? null;
                setSelectedProject(p);
              }}
              style={{ ...inputSt, width: 300 }}
            >
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.category ? ` · ${p.category}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 38, padding: "0 16px", borderRadius: 10,
                border: "0.5px solid rgba(28,20,16,0.15)", background: "#FFFFFF",
                color: "#1C1410", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> New project
            </button>
            {selectedProject && (
              <span style={{ fontSize: 13, color: "#2E7D5E", fontWeight: 600 }}>
                ✓ {selectedProject.title}
              </span>
            )}
          </div>

          {showNewProject && (
            <div style={{
              marginTop: 14, padding: 16, background: "#FFFFFF", borderRadius: 14,
              border: "0.5px solid rgba(28,20,16,0.12)",
              display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap",
            }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#8C7B6B", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Project name *
                </label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Smith residence solar"
                  style={{ ...inputSt, width: 240 }}
                  onKeyDown={(e) => e.key === "Enter" && void createProject()}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#8C7B6B", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Category
                </label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ ...inputSt, width: 180 }}>
                  <option value="">Optional</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={() => void createProject()}
                disabled={!newTitle.trim() || creating}
                style={{
                  height: 38, padding: "0 18px", borderRadius: 10,
                  background: "#1C1410", color: "#D4FF4F",
                  fontSize: 13, fontWeight: 700, border: "none",
                  cursor: !newTitle.trim() || creating ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  opacity: !newTitle.trim() || creating ? 0.6 : 1,
                }}
              >
                {creating && <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />}
                {creating ? "Creating…" : "Create & select"}
              </button>
              <button
                onClick={() => setShowNewProject(false)}
                style={{
                  height: 38, padding: "0 14px", borderRadius: 10,
                  border: "0.5px solid rgba(28,20,16,0.15)", background: "#F7F4EF",
                  color: "#8C7B6B", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              {createError && (
                <p style={{ width: "100%", fontSize: 12, color: "#E8602C", margin: 0 }}>{createError}</p>
              )}
            </div>
          )}
        </div>

        {/* Step 2 — Drop zone */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8C7B6B", marginBottom: 10 }}>
            Step 2 — Add photos
          </p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              minHeight: 300,
              border: `2px dashed ${isDragging ? "#1C1410" : "rgba(28,20,16,0.2)"}`,
              borderRadius: 20,
              background: isDragging ? "rgba(212,255,79,0.05)" : "#F7F4EF",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <UploadCloud style={{ width: 48, height: 48, color: isDragging ? "#1C1410" : "#B4A898", strokeWidth: 1.5 }} />
            <p style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 22, color: "#1C1410", margin: 0 }}>
              {files.length > 0
                ? `${files.length} file${files.length !== 1 ? "s" : ""} selected — drop more or click to add`
                : "Drop photos here"}
            </p>
            <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 14, color: "#8C7B6B", margin: 0 }}>
              Or click to select files · JPG, PNG, WEBP, HEIC supported
            </p>
            <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 12, color: "#B4A898", margin: 0 }}>
              Upload hundreds of photos at once · Max 20 MB per photo
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
        </div>

        {/* Step 3 — Upload queue */}
        {files.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8C7B6B", margin: 0 }}>
                Step 3 — Upload queue
              </p>
              <span style={{ fontSize: 13, color: "#8C7B6B" }}>
                {totalCount} photo{totalCount !== 1 ? "s" : ""} · {formatSize(totalSizeBytes)}
              </span>
            </div>

            {!uploading && (
              <button
                onClick={() => void uploadAll()}
                disabled={!selectedProject}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", height: 52, borderRadius: 14,
                  background: selectedProject ? "#1C1410" : "#E0DDD8",
                  color: selectedProject ? "#D4FF4F" : "#B4A898",
                  fontSize: 15, fontWeight: 700, border: "none",
                  cursor: selectedProject ? "pointer" : "not-allowed",
                  marginBottom: 16, fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                }}
              >
                <UploadCloud style={{ width: 18, height: 18 }} />
                Upload {totalCount} photo{totalCount !== 1 ? "s" : ""} ({formatSize(totalSizeBytes)})
                {!selectedProject && <span style={{ fontSize: 12, opacity: 0.7 }}> — select a project first</span>}
              </button>
            )}

            <div style={{ border: "0.5px solid rgba(28,20,16,0.1)", borderRadius: 14, overflow: "hidden", background: "#FFFFFF" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid rgba(28,20,16,0.08)", background: "#F7F4EF" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8C7B6B", textTransform: "uppercase", letterSpacing: "0.06em", width: 56 }}>
                      Preview
                    </th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8C7B6B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Filename
                    </th>
                    <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#8C7B6B", textTransform: "uppercase", letterSpacing: "0.06em", width: 90 }}>
                      Size
                    </th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8C7B6B", textTransform: "uppercase", letterSpacing: "0.06em", width: 180 }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f, i) => (
                    <tr
                      key={f.id}
                      style={{ borderBottom: i < files.length - 1 ? "0.5px solid rgba(28,20,16,0.05)" : "none" }}
                    >
                      <td style={{ padding: "8px 16px" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.previewUrl}
                          alt=""
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
                        />
                      </td>
                      <td style={{ padding: "8px 16px", color: "#1C1410", maxWidth: 0, width: "99%" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {f.file.name}
                        </span>
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "right", color: "#8C7B6B", whiteSpace: "nowrap" }}>
                        {formatSize(f.file.size)}
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        {f.status === "pending" && (
                          <span style={{ color: "#B4A898", fontSize: 12 }}>Waiting</span>
                        )}
                        {f.status === "uploading" && (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#1C1410" }} />
                              <span style={{ fontSize: 12, color: "#1C1410" }}>{f.progress}%</span>
                            </div>
                            <div style={{ height: 3, background: "rgba(28,20,16,0.08)", borderRadius: 2, width: 100 }}>
                              <div style={{
                                height: 3, background: "#1C1410", borderRadius: 2,
                                width: `${f.progress}%`, transition: "width 0.2s",
                              }} />
                            </div>
                          </div>
                        )}
                        {f.status === "done" && (
                          <span style={{ color: "#2E7D5E", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <Check style={{ width: 13, height: 13 }} /> Done
                          </span>
                        )}
                        {f.status === "error" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "#E8602C", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                              <X style={{ width: 13, height: 13 }} /> Failed
                            </span>
                            <button
                              onClick={() => void uploadSingleFile(f)}
                              style={{
                                fontSize: 11, color: "#1C1410", fontWeight: 600,
                                background: "rgba(28,20,16,0.06)", border: "none",
                                borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                              }}
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
