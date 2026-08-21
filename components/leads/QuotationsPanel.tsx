"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Loader2, Check, X, Copy, Files, GitBranch, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { formatMoney } from "@/lib/quotations/totals";
import { quotationStatusLabel } from "@/lib/quotations/lifecycle";
import type { QuotationLineItemRow, QuotationRow, QuotationStatus, QuoteTemplateRow } from "@/types";

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Props = {
  leadId: string;
  clientId: string;
  leadPhone: string | null;
  dealId?: string | null;
  onChanged?: () => void;
};

export function QuotationsPanel({ leadId, clientId, dealId, onChanged }: Props) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuotationRow[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyToast, setCopyToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/quotations`);
      const json = (await res.json()) as { quotations?: QuotationRow[] };
      setQuotes(json.quotations ?? []);
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
    fetch(`/api/clients/${clientId}/quote-templates`)
      .then((r) => r.json())
      .then((d: { templates?: QuoteTemplateRow[] }) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, [load, clientId]);

  useEffect(() => {
    if (!copyToast) return;
    const t = window.setTimeout(() => setCopyToast(""), 2500);
    return () => window.clearTimeout(t);
  }, [copyToast]);

  function openWorkspace(id: string) {
    router.push(`/sales/quotes/${id}`);
  }

  async function newQuote(templateId?: string) {
    setCreating(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(templateId ? { templateId } : {}),
          ...(dealId ? { dealId } : {}),
        }),
      });
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (json.quotation) openWorkspace(json.quotation.id);
      else if (json.error) setCopyToast(json.error);
    } finally {
      setCreating(false);
    }
  }

  async function duplicateQuote(id: string) {
    const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
    const json = (await res.json()) as { quotation?: QuotationWithItems };
    if (json.quotation) openWorkspace(json.quotation.id);
    await load();
  }

  async function reviseQuote(id: string) {
    const res = await fetch(`/api/quotations/${id}/revise`, { method: "POST" });
    const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
    if (json.quotation) openWorkspace(json.quotation.id);
    else if (json.error) setCopyToast(json.error);
    await load();
  }

  async function setStatus(id: string, status: QuotationStatus) {
    await fetch(`/api/quotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    onChanged?.();
  }

  async function remove(id: string) {
    await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    await load();
  }

  function copyPublicLink(token: string | null) {
    if (!token) return;
    const link = `${window.location.origin}/quote/${token}`;
    void navigator.clipboard.writeText(link).then(() => setCopyToast("Customer link copied"));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Quotations</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-[12px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            New quote
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-card-alt)]"
                onClick={() => void newQuote()}
              >
                Blank quotation
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[var(--surface-card-alt)]"
                  onClick={() => void newQuote(t.id)}
                >
                  From: {t.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {copyToast ? (
        <p className="rounded-lg bg-[var(--success-bg)] px-3 py-1.5 text-[11px] text-[var(--success-fg)]">
          {copyToast}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <FileText className="mx-auto h-6 w-6 text-ink-tertiary" />
          <p className="mt-2 text-[13px] font-semibold">No quotations yet</p>
          <p className="mt-1 text-[11px] text-ink-tertiary">Create a commercial offer for this lead</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {quotes.map((q) => (
            <li
              key={q.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2.5"
            >
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openWorkspace(q.id)}>
                <p className="truncate text-[13px] font-semibold">
                  {q.quote_number || "Draft"}
                  {q.revision_number > 1 ? ` · v${q.revision_number}` : ""}
                </p>
                <p className="text-[11px] text-ink-tertiary">
                  {quotationStatusLabel(q.status)} · {formatMoney(Number(q.total) || 0, q.currency)}
                  {q.valid_until ? ` · until ${format(new Date(q.valid_until), "d MMM")}` : ""}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {q.public_token ? (
                  <button type="button" className="rounded p-1.5 hover:bg-[var(--surface-card-alt)]" onClick={() => copyPublicLink(q.public_token)} title="Copy link">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {q.status === "draft" ? (
                  <button type="button" className="rounded p-1.5 hover:bg-[var(--surface-card-alt)]" onClick={() => void remove(q.id)} title="Delete">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <>
                    <button type="button" className="rounded p-1.5 hover:bg-[var(--surface-card-alt)]" onClick={() => void reviseQuote(q.id)} title="Revise">
                      <GitBranch className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded p-1.5 hover:bg-[var(--surface-card-alt)]" onClick={() => void duplicateQuote(q.id)} title="Duplicate">
                      <Files className="h-3.5 w-3.5" />
                    </button>
                    {q.status === "sent" || q.status === "viewed" ? (
                      <button type="button" className="rounded p-1.5 hover:bg-[var(--surface-card-alt)]" onClick={() => void setStatus(q.id, "accepted")} title="Mark accepted">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
