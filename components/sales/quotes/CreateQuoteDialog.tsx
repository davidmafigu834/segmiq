"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Loader2, Search, X } from "lucide-react";
import {
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/sales/ui";
import type { QuoteTemplateRow, QuotationLineItemRow, QuotationRow } from "@/types";
import { cn } from "@/lib/ui/cn";

export type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Candidate = {
  id: string;
  name: string | null;
  phone: string | null;
  projectType: string | null;
  clientId: string;
  status: string;
};

export function CreateQuoteDialog({
  open,
  candidates,
  hasTemplates,
  onClose,
  onCreated,
}: {
  open: boolean;
  candidates: Candidate[];
  hasTemplates: boolean;
  onClose: () => void;
  onCreated: (quotation: QuotationWithItems, leadPhone: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | "">("");
  const [templates, setTemplates] = useState<QuoteTemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId(null);
      setTemplateId("");
      setTemplates([]);
      setError("");
      setCreating(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selected || !hasTemplates) {
      setTemplates([]);
      setTemplateId("");
      return;
    }
    let cancelled = false;
    setLoadingTemplates(true);
    fetch(`/api/clients/${selected.clientId}/quote-templates`)
      .then((r) => r.json())
      .then((d: { templates?: QuoteTemplateRow[] }) => {
        if (!cancelled) setTemplates((d.templates ?? []).filter((t) => t.is_active !== false));
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selected, hasTemplates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const hay = [c.name, c.phone, c.projectType].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [candidates, query]);

  async function create() {
    if (!selected) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${selected.id}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateId ? { templateId } : {}),
      });
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (!res.ok || !json.quotation) {
        setError(json.error ?? "Couldn't create quote");
        return;
      }
      onCreated(json.quotation, selected.phone);
      onClose();
    } catch {
      setError("Couldn't create quote");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="create-quote-title"
        className="relative z-[61] flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[16px] border border-sales-border bg-sales-surface shadow-sales-popover sm:rounded-[16px]"
      >
        <div className="flex items-center justify-between border-b border-sales-border-subtle px-5 py-4">
          <div>
            <h2 id="create-quote-title" className="text-[16px] font-semibold text-sales-text-primary">
              Create quote
            </h2>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">
              Choose a lead, then open the quotation builder.
            </p>
          </div>
          <button
            type="button"
            className="rounded-sales-md p-2 text-sales-text-muted hover:bg-sales-surface-hover"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, project..."
              className="h-10 pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-[12px] border border-sales-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState
                  size="compact"
                  title={candidates.length === 0 ? "No active leads" : "No matches"}
                  description={
                    candidates.length === 0
                      ? "Add or claim a lead before creating a quotation."
                      : "Try another name or phone number."
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {filtered.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors",
                          active ? "bg-sales-surface-active" : "hover:bg-sales-surface-hover"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            active
                              ? "border-sales-brand-fg bg-sales-brand"
                              : "border-sales-border bg-sales-surface"
                          )}
                          aria-hidden
                        >
                          {active ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-sales-brand-text" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-sales-text-primary">
                            {c.name?.trim() || "Unnamed lead"}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-sales-text-muted">
                            {[c.phone, c.projectType].filter(Boolean).join(" · ") || c.status}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selected && hasTemplates ? (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">
                Template (optional)
              </label>
              {loadingTemplates ? (
                <Skeleton className="h-10 w-full rounded-[10px]" />
              ) : (
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none focus:border-sales-brand focus:ring-2 focus:ring-[rgba(212,255,79,0.35)]"
                >
                  <option value="">Blank quotation</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-sales-border-subtle px-5 py-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!selected || creating}
            onClick={() => void create()}
            leftIcon={
              creating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FilePlus2 size={16} strokeWidth={1.8} />
              )
            }
          >
            {creating ? "Creating…" : "Create quote"}
          </Button>
        </div>
      </div>
    </div>
  );
}
