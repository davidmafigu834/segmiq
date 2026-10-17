"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { allocateCommission, decimalToCents, grossCommissionCents, type AllocationLine } from "@/lib/real-estate/agency-operations";
import {
  ReEmptyState,
  ReErrorState,
  ReMetricGrid,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSkeletonRows,
  ReStatCard,
  ReStatusBadge,
} from "@/components/real-estate/ui";

type Commission = {
  id: string;
  transaction_id: string;
  transactionLabel: string;
  grossCents: number;
  currency: string;
  status: string;
  provenance: string | null;
  earnedCents: number;
  invoicedCents: number;
  reportedReceivedCents: number;
  verifiedReceivedCents: number;
  legacy_fields: Record<string, unknown> | null;
};
type Allocation = {
  id: string;
  commission_id: string;
  beneficiary_id: string | null;
  beneficiary_name: string | null;
  participant_role: string;
  amount_cents: number;
  payout_cents: number;
  reported_payout_cents?: number | null;
  payout_status: string;
  approval_status: string;
};
type Dispute = { id: string; commission_id: string; allocation_id: string | null; reason: string; status: string; opened_by: string | null };
type Totals = {
  projectedCents: number;
  earnedCents: number;
  invoicedCents: number;
  reportedReceivedCents: number;
  verifiedReceivedCents: number;
  approvedCents: number;
  outstandingPayableCents: number;
  paidCents: number;
  legacyUnverifiedCents: number;
  definition: string;
};
type Payload = {
  actorId: string;
  finance: boolean;
  canVerifyReceipt: boolean;
  scope: "organisation" | "own_allocations";
  page: number;
  pageSize: number;
  total: number;
  incomplete: boolean;
  commissions: Commission[];
  allocations: Allocation[];
  disputes: Dispute[];
  totals: Totals;
};

function money(cents: number | null | undefined, currency?: string | null): string {
  const value = Number(cents ?? 0) / 100;
  const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${amount}` : amount;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

const fieldClass = "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm";
const chipButton = "min-h-9 rounded-md border border-sales-border px-2.5 text-xs font-semibold disabled:opacity-50";

async function post(clientId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${clientId}/agency`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

export function CommissionsWorkspace({ clientId, mineOnly = false }: { clientId: string; mineOnly?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/agency?page=${page}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not load commissions.");
      return;
    }
    setError(null);
    setData(json as Payload);
  }, [clientId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const { ok, json } = await post(clientId, body);
    setBusy(false);
    if (!ok) {
      setError((json.error as string) ?? "Could not save the change.");
      return false;
    }
    setError(null);
    setNotice(success);
    await load();
    return true;
  }

  const finance = Boolean(data?.finance);
  const ownView = mineOnly || data?.scope === "own_allocations";
  const totals = data?.totals;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const metricState = error && !data ? "error" : data ? "ready" : "loading";

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:px-6 md:pb-6">
      <RePageHeader
        title={ownView ? "My commissions" : "Commissions"}
        description={
          ownView
            ? "Track your approved allocations and payment progress. A reported receipt is not verified cash."
            : "Track agency earnings, allocations, verification and payouts. A reported receipt is not verified cash."
        }
      />

      <ReMetricGrid label={ownView ? "Your commission summary" : "Agency commission summary"} columns={ownView ? 4 : 4}>
        {ownView ? (
          <>
            <ReStatCard label="My allocations" value={totals ? money(totals.projectedCents) : null} supporting="As returned for your records" state={metricState} />
            <ReStatCard label="Approved" value={totals ? money(totals.approvedCents) : null} state={metricState} />
            <ReStatCard label="Outstanding" value={totals ? money(totals.outstandingPayableCents) : null} state={metricState} attention={Boolean(totals && totals.outstandingPayableCents > 0)} />
            <ReStatCard label="Paid" value={totals ? money(totals.paidCents) : null} supporting="Verified payouts" state={metricState} />
          </>
        ) : (
          <>
            <ReStatCard label="Earned" value={totals ? money(totals.earnedCents) : null} supporting="Not the same as received" state={metricState} />
            <ReStatCard label="Verified received" value={totals ? money(totals.verifiedReceivedCents) : null} supporting={totals ? `Reported ${money(totals.reportedReceivedCents)}` : undefined} state={metricState} />
            <ReStatCard label="Approved outstanding" value={totals ? money(totals.outstandingPayableCents) : null} state={metricState} attention={Boolean(totals && totals.outstandingPayableCents > 0)} />
            <ReStatCard label="Paid to agents" value={totals ? money(totals.paidCents) : null} state={metricState} />
          </>
        )}
      </ReMetricGrid>
      {totals && finance ? (
        <p className="text-[12px] text-sales-text-secondary">
          Also on the ledger: projected {money(totals.projectedCents)}, invoiced {money(totals.invoicedCents)}, allocations approved {money(totals.approvedCents)}.
        </p>
      ) : null}
      {totals && finance && totals.legacyUnverifiedCents > 0 ? (
        <RePartialNotice>
          {money(totals.legacyUnverifiedCents)} comes from older transaction records and has not been verified. It is not included in the figures above.
        </RePartialNotice>
      ) : null}
      {totals?.definition ? <p className="text-[12px] text-sales-text-muted">{totals.definition}</p> : null}
      {data?.incomplete ? (
        <RePartialNotice>Totals could not include every record. Do not treat this page as the complete ledger.</RePartialNotice>
      ) : null}
      {error ? <ReErrorState title="Commissions" description={error} onRetry={() => void load()} /> : null}
      {notice ? <p className="text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
      {!data && !error ? <ReSkeletonRows rows={4} label="Loading commissions" /> : null}

      {data && data.disputes.length > 0 ? (
        <DisputeList
          disputes={data.disputes}
          allocations={data.allocations}
          finance={finance}
          actorId={data.actorId}
          busy={busy}
          onDecide={(body) => act({ action: "review_dispute", ...body }, "Dispute updated.")}
        />
      ) : null}

      <ul className="space-y-3">
        {data && data.commissions.length === 0 ? (
          <li>
            <ReSection id="commissions-empty" title={ownView ? "No commission records" : "No commission records"}>
              <ReEmptyState
                title={ownView ? "No commission records" : "No commission records"}
                description={ownView ? "Your commission allocations will appear here when they are recorded." : "Record a commission from a transaction when the agency is ready to track it."}
              />
            </ReSection>
          </li>
        ) : null}
        {data?.commissions.map((row) => (
          <CommissionCard
            key={row.id}
            row={row}
            lines={data.allocations.filter((line) => line.commission_id === row.id)}
            finance={finance}
            canVerifyReceipt={data.canVerifyReceipt}
            actorId={data.actorId}
            busy={busy}
            act={act}
          />
        ))}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" className={chipButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className={chipButton} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}

      {finance ? <CommissionSetup clientId={clientId} onCreated={() => void load()} /> : null}
    </div>
  );
}

function CommissionCard({
  row,
  lines,
  finance,
  canVerifyReceipt,
  actorId,
  busy,
  act,
}: {
  row: Commission;
  lines: Allocation[];
  finance: boolean;
  canVerifyReceipt: boolean;
  actorId: string;
  busy: boolean;
  act: (body: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const legacy = row.provenance === "legacy_transaction_fields" || row.status === "unverified_legacy";
  const cancelled = row.status === "cancelled";
  const isBeneficiary = lines.some((line) => line.beneficiary_id === actorId);
  const amountCents = amount.trim() ? decimalToCents(amount.trim()) : null;
  const status = (statusAction: string, success: string) =>
    act({ action: "commission_status", commissionId: row.id, statusAction, amountCents: amountCents ?? undefined }, success);

  return (
    <li className="rounded-[12px] border border-sales-border-subtle bg-sales-surface px-3.5 py-3 text-[14px]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{row.transactionLabel}</p>
          <p className="mt-1 font-display text-[22px] font-semibold tabular-nums leading-none">{money(row.grossCents, row.currency)}</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">Gross commission</p>
        </div>
        <ReStatusBadge label={label(row.status)} tone={row.status === "verified_received" || row.status === "paid" ? "success" : row.status === "reported_received" || row.status === "unverified_legacy" || row.status === "disputed" ? "warning" : row.status === "cancelled" ? "danger" : "neutral"} />
      </div>
      {legacy ? (
        <p className="text-xs text-amber-800">Copied from an older transaction record. Not verified. Review before relying on it.</p>
      ) : null}
      {finance && !legacy ? (
        <p className="text-xs text-sales-text-secondary">
          Earned {money(row.earnedCents, row.currency)} · Invoiced {money(row.invoicedCents, row.currency)} · Reported {money(row.reportedReceivedCents, row.currency)} · Verified {money(row.verifiedReceivedCents, row.currency)}
        </p>
      ) : null}
      <ul className="mt-2 space-y-2">
        {lines.map((line) => (
          <AllocationRow key={line.id} line={line} currency={row.currency} finance={finance} actorId={actorId} busy={busy || cancelled} act={act} />
        ))}
      </ul>
      {!cancelled ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {finance ? (
            <>
              <button type="button" className={chipButton} disabled={busy} onClick={() => void status("earn", "Marked earned.")}>Mark earned</button>
              <button type="button" className={chipButton} disabled={busy} onClick={() => void status("invoice", "Marked invoiced.")}>Mark invoiced</button>
              <button type="button" className={chipButton} disabled={busy} onClick={() => void status("approve_allocations", "Allocations approved.")}>Approve allocations</button>
            </>
          ) : null}
          {finance || isBeneficiary ? (
            <>
              <label className="sr-only" htmlFor={`amount-${row.id}`}>Receipt amount</label>
              <input
                id={`amount-${row.id}`}
                className="min-h-9 w-32 rounded-md border border-sales-border bg-sales-surface px-2 text-xs"
                inputMode="decimal"
                placeholder="Amount (optional)"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <button type="button" className={chipButton} disabled={busy} onClick={() => void status("report_receipt", "Receipt reported. It is not verified yet.")}>Report receipt</button>
            </>
          ) : null}
          {canVerifyReceipt ? (
            <button type="button" className={chipButton} disabled={busy} onClick={() => void status("verify_receipt", "Receipt verified.")}>Verify receipt</button>
          ) : null}
          {finance || isBeneficiary ? (
            <button type="button" className={chipButton} disabled={busy} onClick={() => setDisputeOpen(!disputeOpen)}>Dispute</button>
          ) : null}
          {finance ? (
            <button
              type="button"
              className={`${chipButton} text-red-700`}
              disabled={busy}
              onClick={() => {
                if (window.confirm("Cancel this commission? Verified receipts stay on record.")) void status("cancel", "Commission cancelled.");
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {disputeOpen ? (
        <form
          className="mt-2 flex flex-col gap-2 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "dispute", commissionId: row.id, reason }, "Dispute opened.").then((ok) => {
              if (ok) {
                setReason("");
                setDisputeOpen(false);
              }
            });
          }}
        >
          <input required minLength={3} className={fieldClass} placeholder="What is wrong with this commission?" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button type="submit" className="min-h-11 rounded-md border border-sales-border px-3 text-sm font-semibold" disabled={busy}>Open dispute</button>
        </form>
      ) : null}
    </li>
  );
}

function AllocationRow({
  line,
  currency,
  finance,
  actorId,
  busy,
  act,
}: {
  line: Allocation;
  currency: string;
  finance: boolean;
  actorId: string;
  busy: boolean;
  act: (body: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const mine = line.beneficiary_id === actorId;
  const cents = amount.trim() ? decimalToCents(amount.trim()) : null;
  const remaining = Math.max(0, line.amount_cents - line.payout_cents);
  const canReport = (mine || finance) && line.approval_status !== "superseded";
  const canVerify = finance && !mine && line.approval_status === "approved";
  const submit = (verify: boolean) => {
    if (!cents || cents <= 0) return;
    void act(
      { action: "payout", allocationId: line.id, payoutCents: cents, reference: reference || null, verify },
      verify ? "Payout verified." : "Payout reported. It is not verified yet."
    ).then((ok) => {
      if (ok) {
        setAmount("");
        setReference("");
      }
    });
  };
  return (
    <li className="rounded border border-sales-border/70 px-2 py-1.5 text-xs">
      <p>
        <span className="font-semibold">{line.beneficiary_name ?? "Team member"}</span> · {label(line.participant_role)} · {money(line.amount_cents, currency)} · {label(line.approval_status)}
      </p>
      <p className="text-sales-text-secondary">
        Paid (verified) {money(line.payout_cents, currency)}
        {line.reported_payout_cents ? ` · Reported ${money(line.reported_payout_cents, currency)}` : ""} · Outstanding {money(remaining, currency)}
      </p>
      {canReport || canVerify ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          <input className="min-h-9 w-28 rounded-md border border-sales-border bg-sales-surface px-2" inputMode="decimal" placeholder="Amount" aria-label="Payout amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <input className="min-h-9 w-36 rounded-md border border-sales-border bg-sales-surface px-2" placeholder="Payment reference" aria-label="Payment reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          {canReport ? <button type="button" className={chipButton} disabled={busy || !cents} onClick={() => submit(false)}>Report payout</button> : null}
          {canVerify ? <button type="button" className={chipButton} disabled={busy || !cents} onClick={() => submit(true)}>Verify payout</button> : null}
        </div>
      ) : null}
    </li>
  );
}

function DisputeList({
  disputes,
  allocations,
  finance,
  actorId,
  busy,
  onDecide,
}: {
  disputes: Dispute[];
  allocations: Allocation[];
  finance: boolean;
  actorId: string;
  busy: boolean;
  onDecide: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-sales-border p-3">
      <h2 className="text-sm font-semibold">Open disputes</h2>
      <ul className="space-y-2">
        {disputes.map((dispute) => (
          <DisputeRow
            key={dispute.id}
            dispute={dispute}
            line={allocations.find((line) => line.id === dispute.allocation_id) ?? null}
            canDecide={finance && dispute.opened_by !== actorId}
            busy={busy}
            onDecide={onDecide}
          />
        ))}
      </ul>
    </section>
  );
}

function DisputeRow({
  dispute,
  line,
  canDecide,
  busy,
  onDecide,
}: {
  dispute: Dispute;
  line: Allocation | null;
  canDecide: boolean;
  busy: boolean;
  onDecide: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const decide = (decision: string) => {
    const adjusted = decision === "adjusted" ? decimalToCents(amount.trim()) : null;
    void onDecide({ disputeId: dispute.id, decision, note: note || null, adjustedAmountCents: adjusted });
  };
  return (
    <li className="rounded border border-sales-border/70 px-2 py-2 text-xs">
      <p className="font-semibold">{label(dispute.status)}{line ? ` · ${line.beneficiary_name ?? "Team member"} ${money(line.amount_cents)}` : ""}</p>
      <p className="text-sales-text-secondary">{dispute.reason}</p>
      {canDecide ? (
        <div className="mt-2 flex flex-col gap-1.5 md:flex-row md:flex-wrap">
          <input className="min-h-9 flex-1 rounded-md border border-sales-border bg-sales-surface px-2" placeholder="Decision note" aria-label="Decision note" value={note} onChange={(event) => setNote(event.target.value)} />
          {line ? (
            <input className="min-h-9 w-32 rounded-md border border-sales-border bg-sales-surface px-2" inputMode="decimal" placeholder="Corrected amount" aria-label="Corrected amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          ) : null}
          {dispute.status === "open" ? <button type="button" className={chipButton} disabled={busy} onClick={() => decide("reviewing")}>Start review</button> : null}
          <button type="button" className={chipButton} disabled={busy || !note.trim()} onClick={() => decide("upheld")}>Uphold</button>
          {line ? <button type="button" className={chipButton} disabled={busy || !note.trim() || !amount.trim()} onClick={() => decide("adjusted")}>Adjust amount</button> : null}
          <button type="button" className={chipButton} disabled={busy || !note.trim()} onClick={() => decide("resolved")}>Resolve</button>
        </div>
      ) : (
        <p className="mt-1 text-sales-text-muted">Awaiting a decision from someone other than the person who raised it.</p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Allocation setup
// ---------------------------------------------------------------------------

type SetupBeneficiary = { id: string; name: string; role: string; dealRoles: string[]; currentAllocationCents: number; eligible: boolean };
type SetupTemplate = { id: string; name: string; mode: "percent" | "fixed"; basis_points: number | null; fixed_cents: number | null; currency: string };
type Setup = {
  transaction: { id: string; type: string; status: string; currency: string; basisCents: number | null };
  templates: SetupTemplate[];
  existingCommissions: Array<{ id: string; status: string; provenance: string }>;
  beneficiaries: SetupBeneficiary[];
};
type DraftLine = { key: string; beneficiaryId: string; role: string; mode: "percent" | "fixed"; value: string; absorbsRemainder: boolean };

const ROLE_OPTIONS = ["listing_agent", "buyer_agent", "sourcing_agent", "introducing_agent", "transaction_coordinator", "supervising_manager", "additional"];

function CommissionSetup({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [transactions, setTransactions] = useState<Array<{ id: string; propertyLabel: string; status: string }>>([]);
  const [transactionId, setTransactionId] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [rate, setRate] = useState("");
  const [fixed, setFixed] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const found: Array<{ id: string; propertyLabel: string; status: string }> = [];
      for (const tab of ["active", "in_progress", "completed"]) {
        const res = await fetch(`/api/clients/${clientId}/transactions?tab=${tab}`);
        if (!res.ok) continue;
        const json = (await res.json()) as { rows?: Array<{ id: string; propertyLabel: string; status: string }> };
        for (const row of json.rows ?? []) if (!found.some((item) => item.id === row.id)) found.push(row);
      }
      setTransactions(found);
    })();
  }, [clientId]);

  useEffect(() => {
    if (!transactionId) {
      setSetup(null);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/clients/${clientId}/agency?view=commission_setup&transactionId=${transactionId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not load the transaction.");
        return;
      }
      setError(null);
      setSetup(json as Setup);
      setLines([]);
      setTemplateId("");
    })();
  }, [clientId, transactionId]);

  const template = setup?.templates.find((item) => item.id === templateId) ?? null;
  const effectiveMode = template?.mode ?? mode;
  const basisPoints = template ? template.basis_points : rate.trim() ? Math.round(Number(rate) * 100) : null;
  const fixedCents = template ? template.fixed_cents : fixed.trim() ? decimalToCents(fixed.trim()) : null;
  const basisCents = setup?.transaction.basisCents ?? 0;
  const currency = template?.currency ?? setup?.transaction.currency ?? "USD";

  const grossCents = useMemo(() => {
    try {
      return grossCommissionCents({ basisCents, mode: effectiveMode, basisPoints, fixedCents });
    } catch {
      return null;
    }
  }, [basisCents, effectiveMode, basisPoints, fixedCents]);

  const allocationLines: AllocationLine[] = lines
    .filter((line) => line.beneficiaryId)
    .map((line) => ({
      id: line.key,
      beneficiaryId: line.beneficiaryId,
      role: line.role,
      mode: line.mode,
      basisPoints: line.mode === "percent" && line.value.trim() ? Math.round(Number(line.value) * 100) : null,
      fixedCents: line.mode === "fixed" && line.value.trim() ? decimalToCents(line.value.trim()) : null,
      absorbsRemainder: line.absorbsRemainder,
    }));
  const preview = grossCents != null && allocationLines.length ? allocateCommission({ distributableCents: grossCents, lines: allocationLines }) : null;

  const candidates = (setup?.beneficiaries ?? []).filter(
    (person) => !search.trim() || person.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const activeExisting = setup?.existingCommissions.filter((item) => item.status !== "cancelled" && item.provenance !== "legacy_transaction_fields") ?? [];

  function addBeneficiary(person: SetupBeneficiary) {
    const role = person.dealRoles.find((item) => ROLE_OPTIONS.includes(item)) ?? "additional";
    setLines((current) => [
      ...current,
      { key: `${person.id}-${Date.now()}`, beneficiaryId: person.id, role, mode: "percent", value: "", absorbsRemainder: false },
    ]);
    setSearch("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup || grossCents == null || !preview || !preview.ok || !setup.transaction.basisCents) return;
    setSaving(true);
    const { ok, json } = await post(clientId, {
      action: "commission",
      transactionId: setup.transaction.id,
      basisCents: setup.transaction.basisCents,
      mode: effectiveMode,
      basisPoints,
      fixedCents,
      currency,
      templateId: templateId || null,
      lines: allocationLines,
    });
    setSaving(false);
    if (!ok) {
      setError((json.error as string) ?? "Could not save the commission.");
      return;
    }
    setError(null);
    setTransactionId("");
    onCreated();
  }

  return (
    <form className="space-y-3 rounded-lg border border-sales-border p-3" onSubmit={(event) => void submit(event)}>
      <h2 className="text-sm font-semibold">Project a commission</h2>
      <label className="block text-xs font-medium">
        Transaction
        <select className={`${fieldClass} mt-1`} value={transactionId} onChange={(event) => setTransactionId(event.target.value)}>
          <option value="">Choose a transaction</option>
          {transactions.map((row) => (
            <option key={row.id} value={row.id}>{row.propertyLabel} · {label(row.status)}</option>
          ))}
        </select>
      </label>
      {setup ? (
        <>
          <p className="text-xs text-sales-text-secondary">
            Agreed price {setup.transaction.basisCents == null ? "not recorded" : money(setup.transaction.basisCents, setup.transaction.currency)}.
          </p>
          {activeExisting.length ? (
            <p className="text-xs text-amber-800">This transaction already has a commission. Adjust it through a dispute or cancel it before creating another.</p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-xs font-medium">
              Template
              <select className={`${fieldClass} mt-1`} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">Enter manually</option>
                {setup.templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.mode === "percent" ? `${((item.basis_points ?? 0) / 100).toFixed(2)}%` : money(item.fixed_cents, item.currency)}
                  </option>
                ))}
              </select>
            </label>
            {!template ? (
              <>
                <label className="text-xs font-medium">
                  Commission type
                  <select className={`${fieldClass} mt-1`} value={mode} onChange={(event) => setMode(event.target.value as "percent" | "fixed")}>
                    <option value="percent">Percentage of price</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                {mode === "percent" ? (
                  <label className="text-xs font-medium">
                    Rate (%)
                    <input className={`${fieldClass} mt-1`} inputMode="decimal" placeholder="For example 3" value={rate} onChange={(event) => setRate(event.target.value)} />
                  </label>
                ) : (
                  <label className="text-xs font-medium">
                    Amount
                    <input className={`${fieldClass} mt-1`} inputMode="decimal" placeholder="For example 5400.00" value={fixed} onChange={(event) => setFixed(event.target.value)} />
                  </label>
                )}
              </>
            ) : null}
          </div>
          <p className="text-sm font-semibold">Commission: {grossCents == null ? "enter a rate or amount" : money(grossCents, currency)}</p>

          <div className="space-y-2">
            <p className="text-xs font-medium">Beneficiaries</p>
            {lines.length === 0 ? <p className="text-xs text-sales-text-secondary">Add each person who shares this commission. There is no default split.</p> : null}
            {lines.map((line, index) => {
              const person = setup.beneficiaries.find((item) => item.id === line.beneficiaryId);
              const computed = preview && preview.ok ? preview.lines.find((item) => item.id === line.key)?.cents : null;
              return (
                <div key={line.key} className="grid gap-1.5 rounded border border-sales-border/70 p-2 text-xs md:grid-cols-[1fr_auto_auto_auto_auto_auto] md:items-center">
                  <span className="font-semibold">{person?.name ?? "Team member"}</span>
                  <select aria-label="Role" className="min-h-9 rounded-md border border-sales-border bg-sales-surface px-2" value={line.role} onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, role: event.target.value } : item)))}>
                    {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{label(role)}</option>)}
                  </select>
                  <select aria-label="Share type" className="min-h-9 rounded-md border border-sales-border bg-sales-surface px-2" value={line.mode} onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, mode: event.target.value as "percent" | "fixed" } : item)))}>
                    <option value="percent">% of commission</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                  <input aria-label="Share" className="min-h-9 w-28 rounded-md border border-sales-border bg-sales-surface px-2" inputMode="decimal" placeholder={line.mode === "percent" ? "%" : "Amount"} value={line.value} onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))} />
                  <label className="flex items-center gap-1">
                    <input type="radio" name="absorbs" checked={line.absorbsRemainder} onChange={() => setLines(lines.map((item, i) => ({ ...item, absorbsRemainder: i === index })))} />
                    Takes rounding
                  </label>
                  <span className="flex items-center gap-2 tabular-nums">
                    {computed != null ? money(computed, currency) : "—"}
                    <button type="button" className="text-red-700" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove</button>
                  </span>
                </div>
              );
            })}
            <div className="rounded border border-dashed border-sales-border p-2">
              <input className={fieldClass} placeholder="Search the team by name" aria-label="Search the team" value={search} onChange={(event) => setSearch(event.target.value)} />
              {search.trim() ? (
                <ul className="mt-1 max-h-56 overflow-y-auto text-xs">
                  {candidates.slice(0, 20).map((person) => (
                    <li key={person.id}>
                      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-2 text-left hover:bg-sales-surface-hover" onClick={() => addBeneficiary(person)}>
                        <span>
                          <span className="font-semibold">{person.name}</span> · {person.role === "CLIENT_MANAGER" ? "Manager" : "Agent"}
                          {person.dealRoles.length ? ` · ${person.dealRoles.map(label).join(", ")} on this deal` : ""}
                        </span>
                        <span className="text-sales-text-muted">{person.currentAllocationCents ? `already ${money(person.currentAllocationCents, currency)}` : "eligible"}</span>
                      </button>
                    </li>
                  ))}
                  {candidates.length === 0 ? <li className="px-2 py-2 text-sales-text-muted">No active team member matches.</li> : null}
                </ul>
              ) : null}
            </div>
          </div>
          {preview ? (
            preview.ok ? (
              <p className="text-xs">
                Allocated {money((grossCents ?? 0) - preview.remainderCents, currency)} · Unallocated {money(preview.remainderCents, currency)}
                {preview.remainderCents !== 0 ? " (stays with the agency unless someone takes rounding)" : ""}
              </p>
            ) : (
              <p className="text-xs text-red-600">{preview.error}</p>
            )
          ) : null}
          {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
          <button
            className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={saving || !preview?.ok || !setup.transaction.basisCents || activeExisting.length > 0}
          >
            Save projected commission
          </button>
        </>
      ) : error ? (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      ) : null}
    </form>
  );
}
