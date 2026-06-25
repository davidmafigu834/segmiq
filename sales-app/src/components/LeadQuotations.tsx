import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, MessageCircle, Plus } from "lucide-react";
import { apiGet, apiPost, API_BASE } from "../lib/api";
import { formatMoney } from "../lib/format";
import { openWhatsApp } from "../lib/whatsapp";
import { CrmButton } from "./crm";

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

type QuotationRow = {
  id: string;
  quote_number: string | null;
  status: QuotationStatus;
  total: number;
  currency: string | null;
  pdf_url: string | null;
  sent_at: string | null;
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
  leadPhone: string | null;
};

export function LeadQuotations({ leadId, leadPhone }: Props) {
  const [quotes, setQuotes] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
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

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const res = await apiPost<{ quotation?: QuotationRow }>(`/api/leads/${leadId}/quotations`, {});
      if (!res.ok) throw new Error("Could not create quotation");
      await load();
      if (res.data.quotation?.id) {
        window.open(`${API_BASE}/sales/leads?lead=${leadId}`, "_blank");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(quote: QuotationRow) {
    if (!leadPhone) {
      setError("Lead has no phone number.");
      return;
    }
    setSendingId(quote.id);
    setError("");
    try {
      const res = await apiPost<{ waMessage?: string; error?: string }>(
        `/api/quotations/${quote.id}/send`,
        {}
      );
      if (!res.ok || !res.data.waMessage) {
        throw new Error(res.data.error ?? "Send failed — add line items first on web.");
      }
      openWhatsApp(leadPhone, res.data.waMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingId(null);
    }
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
          New
        </button>
      </div>

      {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

      {quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-ink-tertiary" />
          <p className="mt-2 text-[14px] text-ink-secondary">No quotations yet</p>
          <p className="mt-1 text-[13px] text-ink-tertiary">
            Create a draft and add line items on web, then send from here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-xl border border-border bg-surface-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-ink-primary">
                    {q.quote_number ?? "Draft quote"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-tertiary">
                    {formatMoney(Number(q.total) || 0, q.currency ?? "USD")} ·{" "}
                    {STATUS_LABEL[q.status]}
                  </p>
                </div>
                {q.pdf_url ? (
                  <a
                    href={q.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-secondary"
                    aria-label="View PDF"
                  >
                    <ExternalLink size={16} />
                  </a>
                ) : null}
              </div>
              {(q.status === "draft" || q.status === "sent") && leadPhone ? (
                <CrmButton
                  className="mt-3 w-full"
                  disabled={sendingId === q.id}
                  onClick={() => void handleSend(q)}
                >
                  {sendingId === q.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  {q.status === "sent" ? "Resend on WhatsApp" : "Send on WhatsApp"}
                </CrmButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
