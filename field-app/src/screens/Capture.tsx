import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, Check, ImagePlus, Loader2, Plus } from "lucide-react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";
import { ScreenHeader } from "../components/ScreenHeader";
import { OfflineBanner } from "../components/OfflineBanner";
import { NewProjectSheet } from "../components/NewProjectSheet";
import { FWButton, FWSectionLabel } from "../components/fw";
import type { Project } from "../components/ProjectCard";
import { getClientId, resolveActiveClientId } from "../lib/auth";
import { fetchProjects } from "../lib/projects";
import { addToQueue } from "../lib/upload-queue";
import { processQueue } from "../lib/upload";
import { useOnline } from "../hooks/useOnline";

type Props = {
  onTabChange: (tab: TabId) => void;
  onOpenAccount: () => void;
  initialProjectId?: string | null;
};

type LocalPreview = {
  id: string;
  dataUrl: string;
};

export function Capture({ onTabChange, onOpenAccount, initialProjectId }: Props) {
  const online = useOnline();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<LocalPreview[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [toast, setToast] = useState("");

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError("");
    const resolved = await resolveActiveClientId();
    const id = resolved.clientId ?? (await getClientId());
    if (!id) {
      setError(resolved.error ?? "Select a client on the Projects tab first.");
      setLoading(false);
      return;
    }
    setClientIdState(id);
    const { projects: list, error: loadErr } = await fetchProjects(id);
    if (loadErr) {
      setError(loadErr);
      setLoading(false);
      return;
    }
    setProjects(list);
    const pick = initialProjectId && list.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : list[0]?.id ?? "";
    setSelectedId(pick);
    setLoading(false);
  }, [initialProjectId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (initialProjectId && projects.some((p) => p.id === initialProjectId)) {
      setSelectedId(initialProjectId);
    }
  }, [initialProjectId, projects]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }

  async function queuePhoto(base64: string, contentType: string, filename?: string) {
    if (!clientId || !selectedId) return;
    const project = projects.find((p) => p.id === selectedId);
    if (!project) return;

    const item = await addToQueue({
      clientId,
      projectId: selectedId,
      projectTitle: project.title,
      base64,
      contentType,
      filename,
    });

    const dataUrl = `data:${contentType};base64,${base64}`;
    setPreviews((prev) => [{ id: item.id, dataUrl }, ...prev].slice(0, 6));

    if (online) {
      setUploading(true);
      const result = await processQueue();
      setUploading(false);
      if (result.uploaded > 0) {
        showToast(`${result.uploaded} photo${result.uploaded !== 1 ? "s" : ""} uploaded`);
      } else if (result.failed > 0) {
        showToast("Upload failed — check Sync tab to retry");
      }
    } else {
      showToast("Saved offline — will upload when connected");
    }
  }

  async function takePhoto(source: CameraSource) {
    if (!selectedId) {
      setError("Select a project first.");
      return;
    }
    setCapturing(true);
    setError("");
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
      });
      if (!photo.base64String) throw new Error("No photo data");
      const contentType = photo.format === "png" ? "image/png" : "image/jpeg";
      await queuePhoto(photo.base64String, contentType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not capture photo";
      if (!msg.toLowerCase().includes("cancel")) {
        setError(msg);
      }
    } finally {
      setCapturing(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !selectedId) return;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) continue;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await queuePhoto(base64, file.type || "image/jpeg", file.name);
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedId);

  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <OfflineBanner />
      <ScreenHeader eyebrow="Field capture" title="Capture" onOpenAccount={onOpenAccount} />

      <main
        className="flex flex-1 flex-col px-5 py-4"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
          </div>
        )}

        {!loading && error && !projects.length && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && clientId && (
          <>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <FWSectionLabel>Project</FWSectionLabel>
                <button
                  type="button"
                  onClick={() => setShowNewProject(true)}
                  className="flex items-center gap-1 font-fw-body text-[11px] font-semibold text-soil-3"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  New
                </button>
              </div>
              {projects.length === 0 ? (
                <div className="rounded-[16px] border border-black/[0.08] bg-card p-4 text-center">
                  <p className="mb-3 font-fw-body text-[13px] text-warm">No projects yet.</p>
                  <FWButton
                    variant="primary"
                    style={{ height: 40, borderRadius: 12, padding: "0 16px" }}
                    onClick={() => setShowNewProject(true)}
                  >
                    Create a project
                  </FWButton>
                </div>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-card px-3 py-3 font-fw-body text-[13px] text-ink outline-none focus:border-black/20"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedProject && (
              <p className="mb-5 font-fw-body text-xs text-warm">
                Photos upload to <span className="font-semibold text-ink">{selectedProject.title}</span>
                {uploading ? " · Uploading…" : online ? " · Online" : " · Queued offline"}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FWButton
                variant="primary"
                disabled={!selectedId || capturing || uploading}
                style={{ height: 56, borderRadius: 16, flexDirection: "column", gap: 4 }}
                onClick={() => void takePhoto(CameraSource.Camera)}
              >
                {capturing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CameraIcon size={22} strokeWidth={2} />
                )}
                <span className="text-[11px] font-bold">Camera</span>
              </FWButton>

              <FWButton
                variant="secondary"
                disabled={!selectedId || capturing || uploading}
                style={{ height: 56, borderRadius: 16, flexDirection: "column", gap: 4 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={22} strokeWidth={2} />
                <span className="text-[11px] font-bold">Gallery</span>
              </FWButton>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleFileSelect(e)}
            />

            {previews.length > 0 && (
              <div className="mt-6">
                <FWSectionLabel className="mb-2">Recent</FWSectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((p) => (
                    <div
                      key={p.id}
                      className="relative aspect-square overflow-hidden rounded-xl border border-black/[0.08]"
                    >
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <img src={p.dataUrl} className="h-full w-full object-cover" />
                      <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-lime">
                        <Check className="h-3 w-3 text-ink" strokeWidth={3} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && projects.length > 0 && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => onTabChange("sync")}
              className="mt-6 font-fw-body text-xs font-semibold text-soil-3 underline"
            >
              View upload queue →
            </button>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 font-fw-body text-xs font-semibold text-lime shadow-lg">
          {toast}
        </div>
      )}

      {clientId && (
        <NewProjectSheet
          clientId={clientId}
          open={showNewProject}
          onClose={() => setShowNewProject(false)}
          onCreated={(projectId) => {
            void bootstrap().then(() => setSelectedId(projectId));
          }}
        />
      )}

      <TabBar active="capture" onChange={onTabChange} />
    </div>
  );
}
