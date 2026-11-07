"use client";

import { useCallback, useEffect, useState } from "react";
import { ReEmptyState, ReErrorState, ReSection, ReStatusBadge } from "@/components/real-estate/ui";
import { invitationStatusLabel, paymentEvidenceLabel, requirementStateLabel, requirementTone, words } from "@/components/real-estate/compliance/copy";
import type { MandateCheck, MandateComplianceReport } from "@/lib/real-estate/seller-intake/compliance-checks";

type Requirement = { id: string; key: string; label: string; state: string; mandatory: boolean };
type Summary = {
  caseId: string;
  statusLabel: string;
  readiness: string;
  nextAction: string;
  missing: string[];
  requirements: Requirement[];
  invitations: Array<{ id: string; status: string; purpose: string; expires_at: string }>;
  canInvite: boolean;
  canReview: boolean;
  reviewerName: string | null;
  lastReviewedAt: string | null;
  legalRoute?: string | null;
  restricted?: boolean;
};
type Payload = {
  notice?: string;
  summary: Summary | null;
  templates?: Array<{ key: string; label: string; disclaimer: string; requirements: Array<{ key: string; label: string; help: string }> }>;
  transaction?: {
    commercialStage: string;
    complianceReadiness: string;
    legalTransferStatus: string;
    paymentEvidenceStatus: string;
    legalRoute: string | null;
    currency?: string;
    agreedPrice?: number;
  };
  parties?: Array<{ contact_id: string; party_role: string }>;
  error?: string;
  code?: string;
};

export function ContextCompliancePanel({
  clientId,
  context,
  title,
  contactId,
  listingId,
  transactionId,
  customerType = "individual",
  synthetic = null,
  formCheck = null,
}: {
  clientId: string;
  context: "buyer" | "seller" | "property" | "transaction";
  title: string;
  contactId?: string | null;
  listingId?: string | null;
  transactionId?: string | null;
  customerType?: "individual" | "company";
  /** Development preview only. Live pages must not pass this. */
  synthetic?: Payload | null;
  /** Seller page: what the mandate form already satisfies. */
  formCheck?: MandateComplianceReport | null;
}) {
  const [company, setCompany] = useState(customerType === "company");
  const [data, setData] = useState<Payload | null>(synthetic);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [route, setRoute] = useState<"title_deed" | "cession" | "other">("title_deed");
  const [sellerId, setSellerId] = useState(contactId ?? "");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (synthetic) {
      setData(synthetic);
      setSelected((synthetic.summary?.requirements ?? []).filter((item) => item.mandatory && !["verified", "waived", "not_applicable"].includes(item.state)).map((item) => item.key));
      return;
    }
    const params = new URLSearchParams({ context });
    if (contactId) params.set("contactId", contactId);
    if (listingId) params.set("listingId", listingId);
    if (transactionId) params.set("transactionId", transactionId);
    const res = await fetch(`/api/clients/${clientId}/compliance/subjects?${params.toString()}`);
    const json = (await res.json().catch(() => ({}))) as Payload;
    if (res.status === 403) {
      setDenied(true);
      return;
    }
    if (!res.ok && res.status !== 200) {
      setError(json.error ?? "Compliance could not be loaded.");
    } else {
      setError(json.code === "COMPLIANCE_FOUNDATION_UNAVAILABLE" ? json.notice ?? null : null);
    }
    setData(json);
    setSelected((json.summary?.requirements ?? []).filter((item) => item.mandatory && !["verified", "waived", "not_applicable"].includes(item.state)).map((item) => item.key));
  }, [clientId, context, contactId, listingId, synthetic, transactionId]);

  useEffect(() => { void load(); }, [load]);

  async function openCase() {
    if (synthetic) {
      setNotice("Synthetic preview. A case was not opened.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/clients/${clientId}/compliance/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, contactId: contactId || sellerId || undefined, listingId, transactionId, customerType: company ? "company" : "individual", legalRoute: context === "property" || context === "transaction" ? route : undefined }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setNotice(json.error ?? "The case was not opened.");
      return;
    }
    await load();
  }

  async function requestDocuments() {
    if (synthetic) {
      setNotice("Synthetic preview. A document request was not created.");
      return;
    }
    if (!data?.summary || selected.length === 0) {
      setNotice("Choose at least one requirement.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/compliance/centre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", caseId: data.summary.caseId, requirementKeys: selected, purpose: "submission" }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; delivery?: { delivered?: boolean; reason?: string }; path?: string };
    setBusy(false);
    if (!res.ok) {
      setNotice(json.error ?? "The request was not created.");
      return;
    }
    setNotice(json.delivery?.delivered ? "The secure request was emailed with a verification code. The code does not verify legal identity." : "The request was saved, but the email was not accepted. Request documents again to send a new code. Nothing was marked verified.");
    await load();
  }

  async function payment(next: "proof_uploaded" | "independently_confirmed") {
    if (synthetic) {
      setNotice("Synthetic preview. Payment evidence was not changed.");
      return;
    }
    if (!transactionId) return;
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/compliance/centre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "payment", transactionId, next }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setNotice(res.ok ? "Payment evidence status updated. Confirmation is separate from an upload." : json.error ?? "Payment status was not changed.");
    if (res.ok) await load();
  }

  async function legal(milestoneKey: string) {
    if (synthetic) {
      setNotice("Synthetic preview. A milestone was not recorded.");
      return;
    }
    if (!transactionId) return;
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/compliance/centre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "legal_milestone", transactionId, milestoneKey, done: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setNotice(res.ok ? "Legal milestone recorded. Handover does not register a transfer." : json.error ?? "The milestone was not recorded.");
    if (res.ok) await load();
  }

  if (denied) return <ReErrorState title="Compliance is hidden for this record" description="You can see the customer or property, but not this compliance file." />;

  const summary = data?.summary;
  const template = (data?.templates ?? []).find((item) => item.key.includes(company ? "company" : "individual")) ?? data?.templates?.[0];

  const outstanding = summary?.missing.length ?? 0;
  const readinessLine = !summary
    ? null
    : outstanding === 0
      ? "No mandatory item is outstanding on this checklist."
      : outstanding === 1
        ? "One required item still needs attention."
        : `${outstanding} required items still need attention.`;

  return (
    <ReSection
      id={`${context}-compliance`}
      className="max-w-3xl"
      title={title}
      description={formCheck ? "Checked against the mandate form. An answer recorded here is ready for review. It does not verify identity or decide the law." : data?.notice}
    >
      {formCheck ? <FormCheckReport report={formCheck} /> : null}
      {synthetic ? <p className="mb-2 text-[12px] text-sales-text-muted">Synthetic preview. Nothing on this panel is saved.</p> : null}
      {error ? <ReErrorState title="Checklist unavailable" description={error} onRetry={() => void load()} /> : null}
      {notice ? <p className="mb-2 text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
      {(context === "buyer" || context === "seller") && !formCheck ? (
        <div className="mb-3 inline-flex rounded-[8px] border border-sales-border p-0.5" role="group" aria-label="Customer type">
          <button type="button" className={`re-focus min-h-11 rounded-[6px] px-3 text-[13px] font-semibold ${!company ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary"}`} aria-pressed={!company} onClick={() => setCompany(false)}>Individual</button>
          <button type="button" className={`re-focus min-h-11 rounded-[6px] px-3 text-[13px] font-semibold ${company ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary"}`} aria-pressed={company} onClick={() => setCompany(true)}>Company</button>
        </div>
      ) : null}
      {context === "property" && (data?.parties?.length ?? 0) > 0 ? (
        <label className="mb-3 block text-[13px] font-medium">
          Seller on this property
          <select className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 font-normal" value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
            <option value="">Choose the seller</option>
            {data?.parties?.map((party) => <option key={party.contact_id} value={party.contact_id}>{words(party.party_role)}</option>)}
          </select>
        </label>
      ) : null}
      {context === "property" || context === "transaction" ? (
        <label className="mb-3 block text-[13px] font-medium">
          Legal route
          <select className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 font-normal" value={route} onChange={(event) => setRoute(event.target.value as typeof route)}>
            <option value="title_deed">Title-deed transfer</option>
            <option value="cession">Cession or transfer of rights</option>
            <option value="other">Other configured pathway</option>
          </select>
        </label>
      ) : null}
      {data?.transaction ? (
        <dl className="mb-4 grid gap-4 border-y border-sales-border py-3 text-[13px] sm:grid-cols-3">
          <div><dt className="text-[12px] text-sales-text-muted">Sales progress</dt><dd className="mt-0.5 font-medium capitalize">{words(data.transaction.commercialStage)}</dd></div>
          <div><dt className="text-[12px] text-sales-text-muted">Compliance readiness</dt><dd className="mt-0.5 font-medium capitalize">{words(data.transaction.complianceReadiness)}</dd></div>
          <div><dt className="text-[12px] text-sales-text-muted">Legal transfer</dt><dd className="mt-0.5 font-medium capitalize">{words(data.transaction.legalTransferStatus)}</dd></div>
        </dl>
      ) : null}
      {summary ? (
        <div>
          <p className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.02em]">{summary.statusLabel}</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">{readinessLine} {summary.nextAction}</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            {summary.reviewerName ? `Reviewer ${summary.reviewerName}` : "No reviewer assigned"}
            {summary.lastReviewedAt ? ` · Last review ${new Date(summary.lastReviewedAt).toLocaleDateString()}` : ""}
          </p>
          <ul className="mt-3 divide-y divide-sales-border">
            {summary.requirements.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                <label className="flex min-h-11 min-w-0 items-center gap-2">
                  <input type="checkbox" checked={selected.includes(item.key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.key] : current.filter((key) => key !== item.key))} />
                  <span className="truncate">{item.label}{item.mandatory ? "" : " · when applicable"}</span>
                </label>
                <ReStatusBadge tone={requirementTone(item.state)} label={requirementStateLabel(item.state)} />
              </li>
            ))}
          </ul>
          <button type="button" className="re-focus mt-3 min-h-11 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50" disabled={busy || !summary.canInvite} onClick={() => void requestDocuments()}>{busy ? "Working…" : "Request documents"}</button>
          {summary.invitations.length ? (
            <ul className="mt-3 divide-y divide-sales-border text-[13px]">
              {summary.invitations.map((invite) => (
                <li key={invite.id} className="flex justify-between gap-3 py-2">
                  <span className="capitalize">{words(invite.purpose)}</span>
                  <span className="text-sales-text-muted">{invitationStatusLabel(invite.status)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[13px] text-sales-text-muted">No document request has been sent.</p>}
        </div>
      ) : formCheck ? (
        <button type="button" className="re-focus mt-4 min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void openCase()}>{busy ? "Opening…" : "Open a document checklist"}</button>
      ) : (
        <div>
          <ReEmptyState compact title="No compliance case yet" description="Opening a checklist does not block the sale until a reviewed policy is enforced." />
          <button type="button" className="re-focus min-h-11 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" disabled={busy} onClick={() => void openCase()}>{busy ? "Opening…" : "Open checklist"}</button>
        </div>
      )}
      {formCheck ? null : <button type="button" className="re-focus mt-4 min-h-11 text-[13px] font-semibold" aria-expanded={showForm} onClick={() => setShowForm((value) => !value)}>
        {showForm ? "Hide sample fields" : company ? "Show company sample fields" : "Show individual sample fields"}
      </button>}
      {showForm && template ? (
        <ul className="mt-1 divide-y divide-sales-border">
          {template.requirements.map((item) => (
            <li key={item.key} className="py-2">
              <p className="text-[13px] font-medium">{item.label}</p>
              <p className="text-[12px] text-sales-text-muted">{item.help}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data?.transaction ? (
        <div className="mt-6">
          <h3 className="font-display text-[15px] font-semibold">Payments</h3>
          <p className="mt-1 text-[13px] text-sales-text-secondary">{paymentEvidenceLabel(data.transaction.paymentEvidenceStatus)}. An uploaded receipt is not confirmed money.</p>
          <div className="mt-2 flex flex-col gap-3">
            <label className="text-[13px] font-medium">
              Payment file
              <input className="mt-1 block w-full text-[13px] font-normal" type="file" accept="application/pdf,image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !transactionId) return;
                const body = new FormData();
                body.set("file", file);
                setBusy(true);
                void fetch(`/api/clients/${clientId}/compliance/transactions/${transactionId}/payment-evidence`, { method: "POST", body }).then(async (res) => {
                  const json = (await res.json().catch(() => ({}))) as { error?: string };
                  setBusy(false);
                  setNotice(res.ok ? "The payment file is stored and not scanned. It is not confirmation that money was received." : json.error ?? "The payment file was not stored.");
                  if (res.ok) await load();
                });
              }} />
            </label>
            <button type="button" className="re-focus min-h-11 self-start text-[13px] font-semibold" disabled={busy} onClick={() => void payment("independently_confirmed")}>Record independent confirmation</button>
          </div>
          <h3 className="mt-5 font-display text-[15px] font-semibold">Conveyancing</h3>
          <p className="mt-1 text-[13px] text-sales-text-muted">Record a milestone only when that step applies. Handover does not register the transfer.</p>
          <ul className="mt-1 divide-y divide-sales-border">
            {([
              ["conveyancer_instructed", "Conveyancer instructed"],
              ["title_or_rights_check", "Title or rights check"],
              ["rates_clearance", "Rates clearance"],
              ["cgt_clearance", "Tax clearance"],
              ["deeds_or_cession_lodged", route === "cession" ? "Cession submitted" : "Deeds lodged"],
              ["registration_confirmed", "Registration confirmed"],
              ["handover_authorised", "Handover authorised"],
            ] as const).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between gap-3 py-1">
                <span className="text-[13px]">{label}</span>
                <button type="button" className="re-focus min-h-11 shrink-0 text-[13px] font-semibold" disabled={busy} onClick={() => void legal(key)}>Record</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ReSection>
  );
}

function FormCheckReport({ report }: { report: MandateComplianceReport }) {
  return (
    <div className="mb-4">
      <p className="text-[14px] font-medium text-sales-text-primary">{report.summary}</p>
      <CheckGroup title="Good on the form" items={report.recorded} badge="On the form" tone="success" />
      <CheckGroup title="Needs a reviewer" items={report.attention} badge="Review" tone="warning" />
      <CheckGroup title="Still blank" items={report.missing} badge="Missing" tone="warning" />
      {report.notOnForm.length > 0 ? (
        <div className="mt-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Not collected on this form</p>
          <ul className="mt-1">
            {report.notOnForm.map((item) => (
              <li key={item} className="py-1 text-[13px] text-sales-text-secondary">{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CheckGroup({
  title,
  items,
  badge,
  tone,
}: {
  title: string;
  items: MandateCheck[];
  badge: string;
  tone: "success" | "warning";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">{title}</p>
      <ul className="mt-1 divide-y divide-sales-border-subtle">
        {items.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{item.label}</p>
              <p className="text-[12px] text-sales-text-secondary [overflow-wrap:anywhere]">{item.detail}</p>
            </div>
            <ReStatusBadge tone={tone} label={badge} />
          </li>
        ))}
      </ul>
    </div>
  );
}
