"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, Loader2, Check, X, Copy, Files, GitBranch, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { openExternalUrl } from "@/lib/whatsapp-opener";
import { formatMoney } from "@/lib/quotations/totals";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import type { QuotationLineItemRow, QuotationRow, QuotationStatus, QuoteTemplateRow } from "@/types";

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Props = {
  leadId: string;
  clientId: string;
  leadPhone: string | null;
  onChanged?: () => void;
};

const STATUS_STYLE: Record<QuotationStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--surface-card-alt)", fg: "var(--text-tertiary)" },
  sent: { label: "Sent", bg: "var(--accent-muted)", fg: "var(--accent)" },
  viewed: { label: "Viewed", bg: "rgba(59,130,246,0.12)", fg: "#2563eb" },
  accepted: { label: "Accepted", bg: "var(--success-bg)", fg: "var(--success-fg)" },
  rejected: { label: "Rejected", bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
  expired: { label: "Expired", bg: "var(--surface-card-alt)", fg: "var(--text-tertiary)" },
};

export function QuotationsPanel({ leadId, clientId, leadPhone, onChanged }: Props) {
  const [quotes, setQuotes] = useState<QuotationRow[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QuotationWithItems | null>(null);
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

  async function newQuote(templateId?: string) {
    setCreating(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateId ? { templateId } : {}),
      });
      const json = (await res.json()) as { quotation?: QuotationWithItems };
      if (json.quotation) setEditing(json.quotation);
    } finally {
      setCreating(false);
    }
  }

  async function openExisting(id: string) {
    const res = await fetch(`/api/quotations/${id}`);
    const json = (await res.json()) as { quotation?: QuotationWithItems };
    if (json.quotation) setEditing(json.quotation);
  }

  async function duplicateQuote(id: string) {
    const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
    const json = (await res.json()) as { quotation?: QuotationWithItems };
    if (json.quotation) setEditing(json.quotation);
    await load();
  }

  async function reviseQuote(id: string) {
    const res = await fetch(`/api/quotations/${id}/revise`, { method: "POST" });
    const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
    if (json.quotation) setEditing(json.quotation);
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

  if (editing) {
    const readOnly = editing.status !== "draft";
    return (
      <QuotationBuilder
        quotation={editing}
        clientId={clientId}
        leadPhone={leadPhone}
        readOnly={readOnly}
        onSaved={(q) => {
          setEditing(q);
          void load();
        }}
        onSent={() => {
          setEditing(null);
          void load();
          onChanged?.();
        }}
        onClose={() => {
          setEditing(null);
          void load();
        }}
        onRevise={readOnly ? () => void reviseQuote(editing.id) : undefined}
        onDuplicate={() => void duplicateQuote(editing.id)}
      />
    );
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
            New quotation
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-border bg-surface-card shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-surface-card-alt"
                onClick={() => void newQuote()}
              >
                Blank quotation
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="block w-full border-t border-border px-3 py-2 text-left text-[13px] hover:bg-surface-card-alt"
                  onClick={() => void newQuote(t.id)}
                >
                  From template: {t.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {copyToast ? <p className="text-[12px] text-[var(--accent)]">{copyToast}</p> : null}

      {loading ? (
        <p className="py-6 text-center text-[12px] text-ink-tertiary">Loading…</p>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <FileText className="mx-auto h-5 w-5 text-ink-tertiary" />
          <p className="mt-2 text-[13px] text-ink-secondary">No quotations yet.</p>
          <p className="text-[12px] text-ink-tertiary">Start from a template or a blank quote.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {quotes.map((q) => {
            const st = STATUS_STYLE[q.status];
            const canRevise = q.status === "sent" || q.status === "viewed" || q.status === "rejected" || q.status === "expired";
            return (
              <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <button type="button" onClick={() => void openExisting(q.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink-primary">
                      {q.quote_number ?? "Draft"}
                      {q.revision_number > 1 ? ` (rev ${q.revision_number})` : ""}
                    </span>
                    <span
                      className="rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-tertiary">
                    {formatMoney(Number(q.total) || 0, q.currency || "USD")}
                    {q.sent_at ? ` · sent ${format(new Date(q.sent_at), "d MMM")}` : ""}
                    {q.viewed_at ? ` · viewed ${format(new Date(q.viewed_at), "d MMM")}` : ""}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {q.public_token && q.status !== "draft" ? (
                    <button
                      type="button"
                      onClick={() => copyPublicLink(q.public_token)}
                      className="rounded-lg border border-border p-1.5 text-ink-secondary hover:bg-surface-card-alt"
                      aria-label="Copy customer link"
                      title="Copy customer link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void duplicateQuote(q.id)}
                    className="rounded-lg border border-border p-1.5 text-ink-secondary hover:bg-surface-card-alt"
                    aria-label="Duplicate"
                    title="Duplicate"
                  >
                    <Files className="h-3.5 w-3.5" />
                  </button>
                  {canRevise && !q.superseded_by_id ? (
                    <button
                      type="button"
                      onClick={() => void reviseQuote(q.id)}
                      className="rounded-lg border border-border p-1.5 text-ink-secondary hover:bg-surface-card-alt"
                      aria-label="Create revision"
                      title="Create revision"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {q.pdf_url ? (
                    <button
                      type="button"
                      onClick={() => openExternalUrl(`/api/quotations/${q.id}/pdf`)}
                      className="rounded-lg border border-border p-1.5 text-ink-secondary hover:bg-surface-card-alt"
                      aria-label="View PDF"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {q.status === "sent" || q.status === "viewed" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void setStatus(q.id, "accepted")}
                        className="rounded-lg border border-border p-1.5 text-[var(--success-fg)] hover:bg-surface-card-alt"
                        aria-label="Mark accepted"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void setStatus(q.id, "rejected")}
                        className="rounded-lg border border-border p-1.5 text-[var(--danger-fg)] hover:bg-surface-card-alt"
                        aria-label="Mark rejected"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : null}
                  {q.status === "draft" ? (
                    <button
                      type="button"
                      onClick={() => void remove(q.id)}
                      className="rounded-lg border border-border p-1.5 text-ink-tertiary hover:bg-surface-card-alt hover:text-[var(--danger)]"
                      aria-label="Delete draft"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
