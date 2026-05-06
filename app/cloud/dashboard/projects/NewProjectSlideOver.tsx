"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";

const CATEGORIES = [
  "Construction",
  "Solar Installation",
  "Landscaping",
  "Electrical",
  "Plumbing",
  "Interior Design",
  "Roofing",
  "Fencing",
  "Events",
  "Architecture",
  "Other",
];

interface Props {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
  redirectOnCreate?: boolean;
}

export function NewProjectSlideOver({
  clientId,
  open,
  onClose,
  onCreated,
  redirectOnCreate = true,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [description, setDescription] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle("");
    setCategory("");
    setLocation("");
    setCompletionDate("");
    setDescription("");
    setIsFeatured(false);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Project name is required."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category || null,
          location: location.trim() || null,
          completion_date: completionDate || null,
          description: description.trim() || null,
          is_featured: isFeatured,
          is_public: true,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create project."); setLoading(false); return; }
      const projectId = data.id!;
      reset();
      onClose();
      onCreated?.(projectId);
      if (redirectOnCreate) {
        router.push(`/cloud/dashboard/projects/${projectId}`);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel — slides in from right (desktop) / bottom (mobile) */}
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-[#111111] shadow-2xl animate-in slide-in-from-right-full duration-300 md:h-full md:max-h-full">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-base font-semibold text-white">New project</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Project name <span className="text-[#D4FF4F]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
                placeholder="Smith Residence — Solar Install"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#D4FF4F]"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Location / job site
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="123 Main St, Springfield"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Completion date
              </label>
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#D4FF4F] [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What did you do? What materials were used?"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Feature on profile</p>
                <p className="text-xs text-white/40">Shows on your public portfolio page</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFeatured((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${isFeatured ? "bg-[#D4FF4F]" : "bg-white/10"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isFeatured ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</p>
            )}
          </div>

          <div className="border-t border-white/10 px-6 py-4 pb-24 lg:pb-4">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3 text-sm font-semibold text-black transition-colors hover:bg-[#c4ef3f] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
