"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Send } from "lucide-react";
import { MarketingHubTabs } from "./MarketingHubTabs";
import { countBodyVariables } from "@/lib/marketing/template-utils";

type Template = {
  id: string;
  name: string;
  display_name: string | null;
  category: string;
  language: string;
  body: string;
  header: string | null;
  footer: string | null;
  meta_status: string;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-[var(--text-secondary)]",
  pending: "text-[var(--warning)]",
  approved: "text-[var(--success)]",
  rejected: "text-[var(--error)]",
  paused: "text-[var(--warning)]",
};

export function TemplateManager({ clientId }: { clientId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [body, setBody] = useState("");
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [varExample1, setVarExample1] = useState("John");
  const [varExample2, setVarExample2] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/clients/${clientId}/marketing/templates/manage`)
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    const res = await fetch(`/api/clients/${clientId}/marketing/templates/sync`, { method: "POST" });
    const data = await res.json();
    if (data.templates) setTemplates(data.templates);
    setSyncing(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const varCount = countBodyVariables(body);
    const variableExamples = [varExample1, varExample2].filter(Boolean).slice(0, varCount);

    const res = await fetch(`/api/clients/${clientId}/marketing/templates/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        category,
        body,
        header: header || null,
        footer: footer || null,
        variableExamples,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create template");
      setSubmitting(false);
      return;
    }

    setShowForm(false);
    setDisplayName("");
    setBody("");
    setHeader("");
    setFooter("");
    load();
    setSubmitting(false);
  }

  async function handleSubmitToMeta(templateId: string) {
    const res = await fetch(
      `/api/clients/${clientId}/marketing/templates/manage/${templateId}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Submission failed");
      return;
    }
    load();
  }

  const varCount = countBodyVariables(body);

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Templates</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Create WhatsApp templates and submit them to Meta for approval.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync status
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black"
          >
            <Plus className="h-4 w-4" />
            New template
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"
        >
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Create template</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Winter Solar Offer"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Body (use {"{{1}}"}, {"{{2}}"} for variables)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Hi {{1}}, we have a special offer on {{2}} until Friday."
            />
          </div>
          {varCount >= 1 && (
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Example for {"{{1}}"}
              </label>
              <input
                value={varExample1}
                onChange={(e) => setVarExample1(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          )}
          {varCount >= 2 && (
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Example for {"{{2}}"}
              </label>
              <input
                value={varExample2}
                onChange={(e) => setVarExample2(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Header (optional)</label>
              <input
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Footer (optional)</label>
              <input
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="shimmer h-32 rounded-xl" />
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No templates yet. Create a draft and submit it to Meta for approval.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {t.display_name ?? t.name}
                  </p>
                  <p className="font-mono text-xs text-[var(--text-tertiary)]">{t.name}</p>
                  <p className={`mt-1 text-xs capitalize ${STATUS_COLORS[t.meta_status] ?? ""}`}>
                    {t.meta_status}
                    {t.rejection_reason ? ` — ${t.rejection_reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--surface-elevated)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                    {t.category}
                  </span>
                  {(t.meta_status === "draft" || t.meta_status === "rejected") && (
                    <button
                      type="button"
                      onClick={() => void handleSubmitToMeta(t.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
                    >
                      <Send className="h-3 w-3" />
                      Submit to Meta
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{t.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
