"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/sales/ui";
import { ComplianceCasePanel } from "./ComplianceCasePanel";

type CaseRow = {
  id: string;
  status: string;
  statusLabel: string;
  docsReceived: number;
  docsRequired: number;
};

export function InquiryComplianceCard({
  clientId,
  leadId,
  contactId,
  listingId,
  offerStatus,
}: {
  clientId: string;
  leadId: string;
  contactId: string | null;
  listingId?: string | null;
  offerStatus?: string | null;
}) {
  const [row, setRow] = useState<CaseRow | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(
      `/api/clients/${clientId}/compliance/cases?lead_id=${encodeURIComponent(leadId)}&tab=all`
    );
    const j = (await res.json()) as { cases?: CaseRow[] };
    setRow(j.cases?.[0] ?? null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, leadId]);

  async function start() {
    if (!contactId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/compliance/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          lead_id: leadId,
          listing_id: listingId ?? null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; case?: { id: string } };
      if (!res.ok || !j.case?.id) {
        setError(j.error ?? "Could not start CDD.");
        return;
      }
      setOpenId(j.case.id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const accepted = String(offerStatus ?? "").toLowerCase() === "accepted";
  if (!accepted && !row) return null;

  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-neutral-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">Compliance</p>
      {row ? (
        <>
          <p className="mt-1 text-[13px] font-medium">{row.statusLabel}</p>
          <p className="mt-0.5 text-[12px] text-sales-text-secondary">
            Documents {row.docsReceived} of {row.docsRequired} received
          </p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => setOpenId(row.id)}>
            Open CDD
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-[13px] font-medium">CDD has not started.</p>
          <Button variant="primary" size="sm" className="mt-2" disabled={busy || !contactId} onClick={() => void start()}>
            {busy ? "Starting…" : "Start CDD"}
          </Button>
        </>
      )}
      {error ? <p className="mt-1 text-[12px] text-sales-danger">{error}</p> : null}
      {openId ? (
        <ComplianceCasePanel
          clientId={clientId}
          caseId={openId}
          onClose={() => {
            setOpenId(null);
            void load();
          }}
          onChanged={() => void load()}
        />
      ) : null}
    </section>
  );
}
