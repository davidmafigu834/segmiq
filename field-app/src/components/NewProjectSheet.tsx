import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { PROJECT_CATEGORIES } from "../lib/categories";
import { createProject } from "../lib/projects";
import { FWButton, FWSectionLabel } from "./fw";

type Props = {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
};

export function NewProjectSheet({ clientId, open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle("");
    setCategory("");
    setLocation("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Project name is required.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await createProject(clientId, {
      title: title.trim(),
      category: category || null,
      location: location.trim() || null,
    });
    setLoading(false);
    if (result.error || !result.project) {
      setError(result.error ?? "Failed to create project.");
      return;
    }
    const projectId = result.project.id;
    reset();
    onClose();
    onCreated(projectId);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={handleClose}
      />
      <div className="relative max-h-[85vh] overflow-y-auto rounded-t-[24px] bg-card px-5 pb-8 pt-5">
        <div className="mb-5 flex items-center justify-between">
          <FWSectionLabel>New project</FWSectionLabel>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-soil-3" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-fw-body text-[11px] font-semibold text-warm">
              Project name
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kitchen renovation"
              className="w-full rounded-xl border border-black/[0.08] bg-page px-3 py-3 font-fw-body text-[13px] text-ink outline-none focus:border-black/20"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block font-fw-body text-[11px] font-semibold text-warm">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/[0.08] bg-page px-3 py-3 font-fw-body text-[13px] text-ink outline-none focus:border-black/20"
            >
              <option value="">Select category</option>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block font-fw-body text-[11px] font-semibold text-warm">
              Location (optional)
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or site address"
              className="w-full rounded-xl border border-black/[0.08] bg-page px-3 py-3 font-fw-body text-[13px] text-ink outline-none focus:border-black/20"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-fw-body text-xs text-red-700">
              {error}
            </p>
          )}

          <FWButton
            type="submit"
            variant="primary"
            disabled={loading}
            style={{ width: "100%", height: 48, borderRadius: 14 }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create project"
            )}
          </FWButton>
        </form>
      </div>
    </div>
  );
}
