"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FilePlus2, Search, X } from "lucide-react";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { limeBtn, lineBtn } from "@/components/sales/solar/desk";
import {
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/sales/ui";
import type { QuoteTemplateRow, QuotationLineItemRow, QuotationRow } from "@/types";
import { cn } from "@/lib/ui/cn";
import { recommendSolarTemplate } from "@/lib/quotations/layouts/map-fields";
import { RESIDENTIAL_PREMIUM_SOLAR_KEY } from "@/lib/quotations/layouts/types";

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
  const pathname = usePathname();
  const { solarWorkflow, isRealEstate } = useCompanyWorkspace();
  const solarSheet = Boolean(solarWorkflow) && !isRealEstate && (pathname?.startsWith("/sales") ?? false);
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
    if (!open || !selected) {
      setTemplates([]);
      setTemplateId("");
      return;
    }
    let cancelled = false;
    setLoadingTemplates(true);
    fetch(`/api/clients/${selected.clientId}/quote-templates`)
      .then((r) => r.json())
      .then((d: { templates?: QuoteTemplateRow[] }) => {
        if (cancelled) return;
        const rows = (d.templates ?? []).filter((t) => t.is_active !== false);
        const solarFirst = recommendSolarTemplate(selected.name);
        const sorted = [...rows].sort((a, b) => {
          const aSolar = a.layout_key === RESIDENTIAL_PREMIUM_SOLAR_KEY || a.builtin_key === RESIDENTIAL_PREMIUM_SOLAR_KEY;
          const bSolar = b.layout_key === RESIDENTIAL_PREMIUM_SOLAR_KEY || b.builtin_key === RESIDENTIAL_PREMIUM_SOLAR_KEY;
          if (solarFirst && aSolar !== bSolar) return aSolar ? -1 : 1;
          return 0;
        });
        setTemplates(sorted);
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
  }, [open, selected]);

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

  if (solarSheet) {
    return (
      <>
        <button type="button" className="so-sheet-back" aria-label="Close form" onClick={onClose} />
        <aside className="so-sheet" role="dialog" aria-modal="true" aria-label="New quotation">
          <div className="so-sheet-scroll">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-sales-text-muted">Solar installation</p>
                <h2 className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em]">New quotation</h2>
                <p className="mt-2 text-[14px] text-sales-text-secondary">A draft sets Proposal Prepared. Sending it sets Quote Sent.</p>
              </div>
              <button type="button" className={`${lineBtn} inline-flex w-9 items-center justify-center px-0`} onClick={onClose} aria-label="Close">
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="so-form">
              <label className="so-label">
                Customer
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="so-field" placeholder="Search name or phone" autoFocus />
              </label>
              <fieldset>
                <legend className="so-label">Deal</legend>
                {loadingDeals ? <p className="so-hint">Loading deals…</p> : filtered.length === 0 ? (
                  <p className="so-hint">No active deal matches. A quotation belongs to a deal.</p>
                ) : (
                  <div className="so-choices">
                    {filtered.map((deal) => (
                      <button key={deal.id} type="button" className={`so-choice ${selectedId === deal.id ? "is-on" : ""}`} aria-pressed={selectedId === deal.id} onClick={() => setSelectedId(deal.id)}>
                        {deal.leadName || deal.name}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>
              {selected ? (
                <fieldset>
                  <legend className="so-label">Template</legend>
                  <div className="so-choices">
                    <button type="button" className={`so-choice ${templateId === "" ? "is-on" : ""}`} aria-pressed={templateId === ""} onClick={() => setTemplateId("")}>Blank</button>
                    {loadingTemplates ? <span className="so-hint">Loading templates…</span> : templates.map((template) => (
                      <button key={template.id} type="button" className={`so-choice ${templateId === template.id ? "is-on" : ""}`} aria-pressed={templateId === template.id} onClick={() => setTemplateId(template.id)}>{template.name}</button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {error ? <p className="so-alert" role="alert">{error}</p> : null}
              <div className="so-form-actions">
                <button type="button" className={limeBtn} disabled={!selected || creating} onClick={() => void create()}>{creating ? "Saving…" : "Save draft"}</button>
                <button type="button" className={lineBtn} onClick={onClose}>Close</button>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-sales-surface shadow-xl sm:rounded-sales-lg">
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

          {selected ? (
            <div>
              <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Choose quotation template</p>
              {loadingTemplates ? (
                <Skeleton className="h-28 w-full rounded-sales-md" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTemplateId("")}
                    className={cn(
                      "rounded-sales-md border px-3 py-3 text-left",
                      templateId === ""
                        ? "border-sales-brand bg-[var(--sales-brand-soft-solid)]"
                        : "border-sales-border hover:bg-sales-surface-hover"
                    )}
                  >
                    <p className="text-[13px] font-semibold">Blank quotation</p>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">Standard commercial layout.</p>
                  </button>
                  {templates.map((t) => {
                    const solar = t.layout_key === RESIDENTIAL_PREMIUM_SOLAR_KEY || t.builtin_key === RESIDENTIAL_PREMIUM_SOLAR_KEY;
                    const recommended = solar && recommendSolarTemplate(selected.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id)}
                        className={cn(
                          "rounded-sales-md border px-3 py-3 text-left",
                          templateId === t.id
                            ? "border-sales-brand bg-[var(--sales-brand-soft-solid)]"
                            : "border-sales-border hover:bg-sales-surface-hover"
                        )}
                      >
                        {t.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.thumbnail} alt="" className="mb-2 h-16 w-full rounded object-cover object-top bg-sales-neutral-100" />
                        ) : null}
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold">{t.name}</p>
                          {t.is_builtin ? (
                            <span className="rounded-sales-sm bg-sales-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-sales-text-muted">
                              Built-in
                            </span>
                          ) : null}
                          {recommended ? (
                            <span className="rounded-sales-sm bg-sales-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-sales-brand-text">
                              Suggested
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-sales-text-muted">
                          {t.category || (solar ? "Solar" : "Template")}
                          {solar ? " · Visual" : ""}
                        </p>
                        <p className="mt-1 text-[12px] text-sales-text-secondary">
                          {t.description || "Premium visual quotation for residential rooftop solar and battery projects."}
                        </p>
                        <p className="mt-2 text-[12px] font-semibold text-sales-text-primary">Use template</p>
                      </button>
                    );
                  })}
                </div>
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
