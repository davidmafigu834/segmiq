"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import { formatMoney } from "@/lib/quotations/totals";
import type { QuotationRow, QuotationStatus } from "@/types";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";
import { EmptyState, Input, SegmentedTabs } from "@/components/ui";

export type SalesQuoteListItem = QuotationRow & {
  lead_name: string | null;
  lead_phone: string | null;
};

type TabFilter = "all" | "draft" | "sent" | "accepted" | "closed";

const STATUS_STYLE: Record<QuotationStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--surface-card-alt)", fg: "var(--text-tertiary)" },
  sent: { label: "Sent", bg: "var(--accent-muted)", fg: "var(--accent-fg)" },
  viewed: { label: "Viewed", bg: "rgba(59,130,246,0.12)", fg: "#2563eb" },
  accepted: { label: "Accepted", bg: "var(--success-bg)", fg: "var(--success-fg)" },
  rejected: { label: "Rejected", bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
  expired: { label: "Expired", bg: "var(--surface-card-alt)", fg: "var(--text-tertiary)" },
};

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "sent", label: "Sent" },
  { id: "accepted", label: "Accepted" },
  { id: "closed", label: "Rejected / expired" },
];

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 7 * 86400000) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, "MMM d, yyyy");
}

function matchesTab(status: QuotationStatus, tab: TabFilter): boolean {
  if (tab === "all") return true;
  if (tab === "draft") return status === "draft";
  if (tab === "sent") return status === "sent" || status === "viewed";
  if (tab === "accepted") return status === "accepted";
  return status === "rejected" || status === "expired";
}

function StatusBadge({ status }: { status: QuotationStatus }) {
  const st = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
      style={{ background: st.bg, color: st.fg }}
    >
      {st.label}
    </span>
  );
}

export function SalesQuotesClient({ initialQuotes }: { initialQuotes: SalesQuoteListItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialQuotes.filter((quote) => {
      if (!matchesTab(quote.status, tab)) return false;
      if (!q) return true;
      const hay = [
        quote.quote_number,
        quote.lead_name,
        quote.lead_phone,
        quote.customer_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [initialQuotes, tab, search]);

  const counts = useMemo(() => {
    const c: Record<TabFilter, number> = {
      all: initialQuotes.length,
      draft: 0,
      sent: 0,
      accepted: 0,
      closed: 0,
    };
    for (const quote of initialQuotes) {
      if (quote.status === "draft") c.draft++;
      else if (quote.status === "sent" || quote.status === "viewed") c.sent++;
      else if (quote.status === "accepted") c.accepted++;
      else if (quote.status === "rejected" || quote.status === "expired") c.closed++;
    }
    return c;
  }, [initialQuotes]);

  const columns: ResponsiveTableColumn<SalesQuoteListItem>[] = [
    {
      key: "quote",
      label: "Quote",
      mobilePrimary: true,
      render: (q) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink-primary">
              {q.quote_number ?? "Draft"}
              {q.revision_number > 1 ? ` · rev ${q.revision_number}` : ""}
            </span>
            <StatusBadge status={q.status} />
          </div>
          <div className="mt-0.5 font-mono text-xs text-ink-tertiary">
            {formatMoney(Number(q.total) || 0, q.currency || "USD")}
          </div>
        </div>
      ),
    },
    {
      key: "lead",
      label: "Lead",
      render: (q) => (
        <div>
          <div className="text-sm text-ink-primary">{q.lead_name ?? "—"}</div>
          <div className="font-mono text-xs text-ink-tertiary">{q.lead_phone ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "updated",
      label: "Updated",
      render: (q) => (
        <span className="text-sm text-ink-secondary">{whenLabel(q.updated_at)}</span>
      ),
    },
    {
      key: "sent",
      label: "Sent",
      mobileHidden: true,
      render: (q) => (
        <span className="text-sm text-ink-secondary">
          {q.sent_at ? format(new Date(q.sent_at), "MMM d, yyyy") : "—"}
        </span>
      ),
    },
  ];

  function openQuote(leadId: string) {
    router.push(`/sales/leads?lead=${leadId}&tab=quote`);
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-secondary">
          All quotations on your assigned leads. Tap a row to open the quote on that lead.
        </p>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quote # or lead…"
          className="sm:max-w-xs"
        />
      </div>

      <div className="scrollbar-hide mb-6 overflow-x-auto">
        <SegmentedTabs
          aria-label="Filter quotes"
          value={tab}
          onValueChange={(value) => setTab(value as TabFilter)}
          tabs={TABS.map((item) => ({
            value: item.id,
            label: (
              <>
                {item.label}
                {counts[item.id] > 0 ? (
                  <span className="ml-1.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                    {counts[item.id]}
                  </span>
                ) : null}
              </>
            ),
          }))}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-card">
          <EmptyState
            icon={FileText}
            title={initialQuotes.length === 0 ? "No quotes yet" : "No quotes match this filter"}
            description={
              initialQuotes.length === 0
                ? "Open a lead from My leads and use the Quote tab to create your first quotation."
                : "Try another tab or clear your search."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-card">
          <ResponsiveTable
            columns={columns}
            rows={filtered}
            rowKey={(q) => q.id}
            onRowClick={(q) => openQuote(q.lead_id)}
          />
        </div>
      )}
    </div>
  );
}
