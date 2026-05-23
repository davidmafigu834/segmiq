"use client";

import { useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { closeLeadPanel, openLeadPanel } from "@/store/uiStore";
import type { LeadRow } from "@/types";

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error("Failed to load");
    return r.json() as Promise<{ lead: Record<string, unknown> }>;
  });

function apiLeadToRow(lead: Record<string, unknown>): LeadRow {
  return {
    id: String(lead.id),
    client_id: String(lead.client_id),
    assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
    source: lead.source as LeadRow["source"],
    status: lead.status as LeadRow["status"],
    form_data: (lead.form_data as Record<string, unknown>) ?? {},
    name: (lead.name as string | null) ?? null,
    phone: (lead.phone as string | null) ?? null,
    email: (lead.email as string | null) ?? null,
    budget: (lead.budget as string | null) ?? null,
    project_type: (lead.project_type as string | null) ?? null,
    timeline: (lead.timeline as string | null) ?? null,
    magic_token: (lead.magic_token as string | null) ?? null,
    magic_token_expires_at: (lead.magic_token_expires_at as string | null) ?? null,
    not_qualified_reason: (lead.not_qualified_reason as string | null) ?? null,
    lost_reason: (lead.lost_reason as string | null) ?? null,
    deal_value: lead.deal_value != null ? Number(lead.deal_value) : null,
    follow_up_date: (lead.follow_up_date as string | null) ?? null,
    facebook_lead_id: (lead.facebook_lead_id as string | null) ?? null,
    created_at: String(lead.created_at),
    updated_at: String(lead.updated_at),
    score: lead.score != null ? Number(lead.score) : null,
    score_updated_at: (lead.score_updated_at as string | null) ?? null,
    score_breakdown: (lead.score_breakdown as Record<string, number> | null) ?? null,
    is_stale: (lead.is_stale as boolean | null) ?? null,
    stale_since: (lead.stale_since as string | null) ?? null,
  };
}

export function AgencyLeadDrawer() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const leadId = searchParams.get("lead");
  const { data, error, isLoading, mutate } = useSWR(leadId ? `/api/leads/${leadId}` : null, fetcher);

  const leadRow = useMemo(
    () => (data?.lead ? apiLeadToRow(data.lead as Record<string, unknown>) : null),
    [data?.lead]
  );

  useEffect(() => {
    if (leadRow) openLeadPanel(leadRow.id);
    else if (!leadId) closeLeadPanel();
  }, [leadId, leadRow]);

  const handleClose = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("lead");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    closeLeadPanel();
  }, [pathname, router, searchParams]);

  if (!leadId) return null;

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface-overlay px-6">
        <p className="text-sm text-ink-secondary">Could not load this lead.</p>
        <button type="button" className="btn-secondary text-sm" onClick={handleClose}>
          Close
        </button>
      </div>
    );
  }

  if (!leadRow) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay">
        <p className="font-mono text-xs uppercase text-ink-tertiary">{isLoading ? "Loading…" : "…"}</p>
      </div>
    );
  }

  return (
    <LeadDetailPanel
      leads={[leadRow]}
      onClose={handleClose}
      onLeadUpdated={() => {
        void mutate();
        router.refresh();
      }}
    />
  );
}
