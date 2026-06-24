"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, Loader2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { openExternalUrl } from "@/lib/whatsapp-opener";
import { formatMoney } from "@/lib/quotations/totals";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import type { QuotationLineItemRow, QuotationRow, QuotationStatus } from "@/types";

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
  accepted: { label: "Accepted", bg: "var(--success-bg)", fg: "var(--success-fg)" },
  rejected: { label: "Rejected", bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
  expired: { label: "Expired", bg: "var(--surface-card-alt)", fg: "var(--text-tertiary)" },
};

export function QuotationsPanel({ leadId, clientId, leadPhone, onChanged }: Props) {
  const [quotes, setQuotes] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QuotationWithItems | null>(null);

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
  }, [load]);

  async function newQuote() {
    setCreating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/quotations`, { method: "POST" });
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

  if (editing) {
    return (
      <QuotationBuilder
        quotation={editing}
        clientId={clientId}
        leadPhone={leadPhone}
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
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Quotations</p>
        <button
          type="button"
          onClick={() => void newQuote()}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-[12px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New quotation
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-[12px] text-ink-tertiary">Loading…</p>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <FileText className="mx-auto h-5 w-5 text-ink-tertiary" />
          <p className="mt-2 text-[13px] text-ink-secondary">No quotations yet.</p>
          <p className="text-[12px] text-ink-tertiary">Create one to send this lead a branded quote.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {quotes.map((q) => {
            const st = STATUS_STYLE[q.status];
            return (
              <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <button type="button" onClick={() => void openExisting(q.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink-primary">
                      {q.quote_number ?? "Draft"}
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
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  {q.pdf_url ? (
                    <button
                      type="button"
                      onClick={() => openExternalUrl(`/api/quotations/${q.id}/pdf`)}
                      className="rounded-lg border border-border p-1.5 text-ink-secondary hover:bg-surface-card-alt hover:text-ink-primary"
                      aria-label="View PDF"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {q.status === "sent" ? (
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
