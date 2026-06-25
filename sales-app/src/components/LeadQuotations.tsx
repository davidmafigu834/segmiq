import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FileText, Loader2, Plus } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { formatMoney } from "../lib/format";
import { QuotationBuilder } from "./QuotationBuilder";

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

type QuotationRow = {
  id: string;
  quote_number: string | null;
  status: QuotationStatus;
  total: number;
  currency: string | null;
  pdf_url: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  tax_rate: number;
  other_amount: number;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  items?: Array<{
    id?: string;
    catalog_item_id: string | null;
    item_name: string;
    description: string | null;
    unit_price: number;
    quantity: number;
    group_label: string | null;
  }>;
};

const STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

type Props = {
  leadId: string;
  clientId: string;
  leadPhone: string | null;
};

export function LeadQuotations({ leadId, clientId, leadPhone }: Props) {
  const [quotes, setQuotes] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QuotationRow | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<{ quotations?: QuotationRow[] }>(`/api/leads/${leadId}/quotations`);
      if (!res.ok) throw new Error("Failed to load quotations");
      setQuotes(res.data.quotations ?? []);
    } catch {
      setQuotes([]);
      setError("Could not load quotations.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openQuote(id: string) {
    const res = await apiGet<{ quotation?: QuotationRow }>(`/api/quotations/${id}`);
    if (res.ok && res.data.quotation) setEditing(res.data.quotation);
    else setError("Could not open quotation.");
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const res = await apiPost<{ quotation?: QuotationRow }>(`/api/leads/${leadId}/quotations`, {});
      if (!res.ok || !res.data.quotation) throw new Error("Could not create quotation");
      setEditing(res.data.quotation);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  if (editing) {
    return (
      <QuotationBuilder
        quotation={editing}
        clientId={clientId}
        leadPhone={leadPhone}
        onSaved={(q) => {
          setEditing((prev) =>
            prev ? ({ ...prev, ...q, status: (q.status as QuotationStatus) ?? prev.status } as QuotationRow) : null
          );
          void load();
        }}
        onSent={() => {
          setEditing(null);
          void load();
        }}
        onClose={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow mb-0">Quotations</p>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-accent-ink disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New quote
        </button>
      </div>

      {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

      {quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-ink-tertiary" />
          <p className="mt-2 text-[14px] text-ink-secondary">No quotations yet</p>
          <p className="mt-1 text-[13px] text-ink-tertiary">Create a quote, add line items, and send on WhatsApp.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {quotes.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => void openQuote(q.id)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-card p-4 text-left active:bg-bg-tertiary"
              >
                <div>
                  <p className="text-[15px] font-semibold text-ink-primary">
                    {q.quote_number ?? "Draft quote"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-tertiary">
                    {formatMoney(Number(q.total) || 0, q.currency ?? "USD")} · {STATUS_LABEL[q.status]}
                  </p>
                </div>
                <ChevronRight size={18} className="text-ink-tertiary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
