"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Search, X } from "lucide-react";
import {
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/sales/ui";
import type { QuoteTemplateRow, QuotationLineItemRow, QuotationRow } from "@/types";
import { cn } from "@/lib/ui/cn";

export type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type DealCandidate = {
  id: string;
  name: string;
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  clientId: string;
  stage: string | null;
};

export function CreateQuoteDialog({
  open,
  hasTemplates,
  dealId: prefDealId,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** @deprecated Lead candidates unused — Deal selection is required */
  candidates?: unknown[];
  hasTemplates: boolean;
  dealId?: string | null;
  onClose: () => void;
  onCreated: (quotation: QuotationWithItems, leadPhone: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [deals, setDeals] = useState<DealCandidate[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | "">("");
  const [templates, setTemplates] = useState<QuoteTemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selected = deals.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId(null);
      setTemplateId("");
      setTemplates([]);
      setError("");
      setCreating(false);
      setDeals([]);
      return;
    }
    let cancelled = false;
    setLoadingDeals(true);
    fetch("/api/deals?scope=active")
      .then((r) => r.json())
      .then((d: { deals?: Array<{
        deal?: Record<string, unknown>;
        customerName?: string | null;
        customerPhone?: string | null;
      }> }) => {
        if (cancelled) return;
        const rows = (d.deals ?? []).map((row) => {
          const deal = (row.deal ?? {}) as Record<string, unknown>;
          return {
            id: String(deal.id ?? ""),
            name: String(deal.name || deal.service_summary || "Deal"),
            leadId: String(deal.originating_lead_id ?? ""),
            leadName: row.customerName ?? null,
            leadPhone: row.customerPhone ?? null,
            clientId: String(deal.client_id ?? ""),
            stage: (deal.stage as string) || null,
          } satisfies DealCandidate;
        }).filter((x) => x.id && x.leadId);
        setDeals(rows);
        if (prefDealId && rows.some((r) => r.id === prefDealId)) {
          setSelectedId(prefDealId);
        }
      })
      .catch(() => {
        if (!cancelled) setDeals([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDeals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, prefDealId]);

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
    if (!q) return deals;
    return deals.filter((d) => {
      const hay = [d.name, d.leadName, d.leadPhone, d.stage].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [deals, query]);

  async function create() {
    if (!selected) {
      setError("Select a Deal to continue");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const body: { templateId?: string; dealId: string } = { dealId: selected.id };
      if (templateId) body.templateId = templateId;
      const res = await fetch(`/api/leads/${selected.leadId}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (!res.ok || !json.quotation) {
        setError(json.error ?? "Couldn't create quote");
        return;
      }
      onCreated(json.quotation, selected.leadPhone);
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
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-sales-surface shadow-xl sm:rounded-sales-lg">
        <div className="flex items-center justify-between border-b border-sales-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-sales-text-primary">Create quotation</h2>
            <p className="text-[12px] text-sales-text-secondary">
              Select the Deal this commercial offer belongs to.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-sales-text-muted" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sales-text-muted" />
            <Input
              className="pl-9"
              placeholder="Search Deal, customer, phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {loadingDeals ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-sales-md" />
              <Skeleton className="h-14 w-full rounded-sales-md" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 className="h-5 w-5" />}
              title="No active Deals"
              description="Create a Deal first, then build a quotation for it."
            />
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {filtered.map((d) => {
                const active = d.id === selectedId;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "w-full rounded-sales-md border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-sales-brand bg-[var(--sales-brand-soft-solid)]"
                          : "border-sales-border hover:bg-sales-surface-hover"
                      )}
                    >
                      <p className="text-[13px] font-semibold text-sales-text-primary">{d.name}</p>
                      <p className="text-[12px] text-sales-text-secondary">
                        {[d.leadName, d.leadPhone].filter(Boolean).join(" · ") || "Customer"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected && hasTemplates ? (
            <div>
              <p className="mb-1 text-[12px] font-medium text-sales-text-secondary">Template (optional)</p>
              {loadingTemplates ? (
                <Skeleton className="h-10 w-full rounded-sales-md" />
              ) : (
                <select
                  className="w-full rounded-sales-md border border-sales-border-strong bg-sales-surface px-3 py-2 text-[13px]"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
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

          {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-sales-border px-4 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={creating}
            leftIcon={<FilePlus2 className="h-3.5 w-3.5" />}
            onClick={() => void create()}
            disabled={!selected}
          >
            Create quotation
          </Button>
        </div>
      </div>
    </div>
  );
}
