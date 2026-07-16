"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getPublicInstantFormUrl } from "@/lib/public-url";
import type { InstantFormRow } from "@/types";

type FormListItem = Pick<
  InstantFormRow,
  "id" | "name" | "slug" | "status" | "form_type" | "submission_count" | "created_at" | "updated_at"
>;

export function InstantFormsList({
  clientId,
  initialForms,
}: {
  clientId: string;
  initialForms: FormListItem[];
}) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [creating, setCreating] = useState(false);
  const [creatingSegmiq, setCreatingSegmiq] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreateSegmiqAcquisition() {
    setCreatingSegmiq(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/instant-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: "segmiq_client_acquisition",
          publish: true,
          linkWhatsApp: true,
        }),
      });
      const data = (await res.json()) as { form?: FormListItem; error?: string };
      if (res.ok && data.form) {
        setForms((prev) => [data.form!, ...prev]);
        router.push(`/dashboard/clients/${clientId}/instant-forms/${data.form.id}`);
        return;
      }
      alert(data.error ?? "Could not create Segmiq qualification form.");
    } finally {
      setCreatingSegmiq(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/instant-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Instant Form" }),
      });
      const data = (await res.json()) as { form?: FormListItem };
      if (res.ok && data.form) {
        router.push(`/dashboard/clients/${clientId}/instant-forms/${data.form.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(formId: string) {
    if (!confirm("Delete this form? This cannot be undone.")) return;
    setDeletingId(formId);
    try {
      const res = await fetch(`/api/clients/${clientId}/instant-forms/${formId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setForms((prev) => prev.filter((f) => f.id !== formId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function copyUrl(form: FormListItem) {
    const url = getPublicInstantFormUrl(form.slug);
    await navigator.clipboard.writeText(url);
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl text-ink-primary">Instant Forms</h3>
          <p className="mt-1 text-sm text-ink-tertiary">
            Facebook-style multi-screen lead forms, each with its own public link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleCreateSegmiqAcquisition()}
            disabled={creatingSegmiq || creating}
          >
            {creatingSegmiq ? "Setting up…" : "Segmiq ad qualification"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void handleCreate()}
            disabled={creating || creatingSegmiq}
          >
            {creating ? "Creating…" : "Create blank form"}
          </button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-card-alt p-12 text-center">
          <p className="text-ink-secondary">No instant forms yet.</p>
          <p className="mt-2 text-sm text-ink-tertiary">
            Use <strong className="text-ink-secondary">Segmiq ad qualification</strong> for Facebook ad leads
            on your own WhatsApp number — publishes the form and links it to WhatsApp auto-qualification.
          </p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => void handleCreateSegmiqAcquisition()}
            disabled={creatingSegmiq}
          >
            {creatingSegmiq ? "Setting up…" : "Segmiq ad qualification"}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-card-alt">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Name
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Status
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Type
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Submissions
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${clientId}/instant-forms/${form.id}`}
                      className="font-medium text-ink-primary hover:underline"
                    >
                      {form.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-tertiary">/f/{form.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        form.status === "published"
                          ? "bg-[rgba(46,125,94,0.12)] text-[var(--success)]"
                          : "bg-surface-card-alt text-ink-tertiary"
                      }`}
                    >
                      {form.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {form.form_type === "higher_intent" ? "Higher intent" : "More volume"}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{form.submission_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/clients/${clientId}/instant-forms/${form.id}`}
                        className="text-xs text-[var(--info)] hover:underline"
                      >
                        Edit
                      </Link>
                      {form.status === "published" ? (
                        <button
                          type="button"
                          className="text-xs text-ink-secondary hover:underline"
                          onClick={() => void copyUrl(form)}
                        >
                          {copiedId === form.id ? "Copied!" : "Copy URL"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-[var(--danger)] hover:underline"
                        onClick={() => void handleDelete(form.id)}
                        disabled={deletingId === form.id}
                      >
                        {deletingId === form.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
