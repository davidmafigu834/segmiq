"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";

function suggestSlugFromName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s.length > 0 ? s : "client";
}

export function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [soloOperator, setSoloOperator] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setIndustry("");
    setSlug("");
    setSlugTouched(false);
    setSoloOperator(false);
    setOwnerName("");
    setOwnerEmail("");
    setOwnerPhone("");
    setError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setError(null);
  }, [open, reset]);

  useEffect(() => {
    if (!open || slugTouched) return;
    setSlug(suggestSlugFromName(name));
  }, [name, open, slugTouched]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const slugNorm = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slugNorm)) {
      setError("Slug may only contain lowercase letters, numbers, and hyphens.");
      return;
    }
    if (soloOperator) {
      if (!ownerName.trim() || !ownerEmail.trim() || !ownerPhone.trim()) {
        setError("Owner name, email, and phone are required for solo clients.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        industry: industry.trim(),
        slug: slugNorm,
        mode: soloOperator ? "solo" : "team",
      };
      if (soloOperator) {
        body.owner = {
          name: ownerName.trim(),
          email: ownerEmail.trim(),
          phone: ownerPhone.trim(),
        };
      }
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; client?: { id?: string } };
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not create client");
        return;
      }
      const id = j.client?.id;
      if (!id) {
        setError("Created but no client id returned.");
        return;
      }
      onClose();
      reset();
      router.push(`/dashboard/clients/${id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-overlay md:items-center md:justify-center md:px-4 md:py-8">
      <div className="flex h-full w-full flex-col border border-border bg-surface-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-lg">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:h-auto md:border-b-0 md:px-6 md:pt-6">
          <button type="button" className="flex h-9 w-9 items-center justify-center md:hidden" onClick={onClose} aria-label="Back">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <h2 className="min-w-0 flex-1 truncate font-display text-xl text-ink-primary">New client</h2>
          <button
            type="button"
            className="hidden text-ink-tertiary hover:text-ink-primary md:block"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pt-2">
            <p className="mt-2 text-sm text-ink-secondary">
              {soloOperator
                ? "Creates a solo-operator client with one owner account. They land on the unified dashboard — no separate manager login."
                : "After you create the client, you will go to their overview to finish setup (landing page, form, team, and optional Facebook)."}
            </p>
            <div className="mt-6 space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-card-alt px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={soloOperator}
                  onChange={(e) => setSoloOperator(e.target.checked)}
                />
                <span>
                  <span className="block text-[13px] font-semibold text-ink-primary">Solo operator</span>
                  <span className="block text-[12px] text-ink-secondary">
                    One owner runs the whole business — no manager or sales team.
                  </span>
                </span>
              </label>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Client name *</label>
                <input
                  className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Industry *</label>
                <input
                  className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  placeholder="e.g. Solar, HVAC"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">URL slug *</label>
                <input
                  className="input-base h-11 w-full font-mono text-base md:h-10 md:text-sm"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  required
                  pattern="[a-z0-9-]+"
                  title="Lowercase letters, numbers, and hyphens only"
                  placeholder="acme-roofing"
                />
                <p className="mt-1 text-xs text-ink-tertiary">Used in public URLs: /p/{slug || "your-slug"} …</p>
              </div>
              {soloOperator ? (
                <div className="space-y-4 rounded-lg border border-border bg-surface-card-alt p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-secondary">Owner account</p>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Owner name *</label>
                    <input
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required={soloOperator}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Owner email *</label>
                    <input
                      type="email"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      required={soloOperator}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Owner phone *</label>
                    <input
                      type="tel"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      required={soloOperator}
                      placeholder="+263 77 123 4567"
                    />
                  </div>
                </div>
              ) : null}
              {error ? <p className="text-sm text-[var(--status-lost-fg)]">{error}</p> : null}
            </div>
          </div>
          <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border p-4 md:px-6 md:pb-6">
            <button type="button" className="btn-ghost h-11 flex-1 md:h-9 md:flex-none" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary h-11 flex-1 md:h-9 md:flex-none" disabled={submitting}>
              {submitting ? "Creating…" : soloOperator ? "Create solo client" : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
