"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P5 H4 E4 S4 R4 V4 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, History, SearchX, ShieldCheck } from "lucide-react";
import { ReEmptyState, ReErrorState, RePageHeader, ReSkeletonRows, ReStatusBadge } from "@/components/real-estate/ui";
import { caseTypeLabel, invitationStatusLabel, requirementStateLabel, requirementTone, scanStatusLabel, waitingLabel, words } from "@/components/real-estate/compliance/copy";

type QueueRow = {
  id: string;
  caseId: string;
  caseType: string;
  requirement: string;
  state: string;
  submittedAt: string;
  nextAction: string;
};

type CentrePayload = {
  counts?: { pendingReviews: number; changesRequested: number; escalated: number };
  queue?: QueueRow[];
  canReview?: boolean;
  policies?: Array<{ id: string; template_key: string; version: number; status: string; enforcement: { listing_publication?: boolean }; review_note?: string | null }>;
  templates?: Array<{ key: string; label: string; disclaimer: string }>;
  events?: Array<{ id: string; summary: string; at: string }>;
  evidence?: Array<{ id: string; caseId?: string; label: string; filename: string | null; uploadedAt: string; version: number; scanStatus: string; canOpen: boolean }>;
  requests?: Array<{ id: string; caseType: string; purpose: string; status: string; expiresAt: string; sentAt: string | null; submittedAt: string | null }>;
  canManage?: boolean;
  error?: string;
  code?: string;
  page?: number;
  hasMore?: boolean;
};

type Section = "overview" | "queue" | "buyers" | "sellers" | "properties" | "transactions" | "requests" | "policies" | "audit";
type QueueFilter = "all" | "awaiting" | "changes" | "review" | "escalated";

const NAV: Array<{ id: Section; label: string; managerOnly?: boolean }> = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Review queue" },
  { id: "buyers", label: "Buyers" },
  { id: "sellers", label: "Sellers" },
  { id: "properties", label: "Properties" },
  { id: "transactions", label: "Transactions" },
  { id: "requests", label: "Document requests" },
  { id: "policies", label: "Policies", managerOnly: true },
  { id: "audit", label: "Audit log", managerOnly: true },
];

function contextOf(section: Section): string | null {
  if (section === "buyers") return "buyer";
  if (section === "sellers") return "seller";
  if (section === "properties") return "property";
  if (section === "transactions") return "transaction";
  return null;
}

function matchesFilter(row: QueueRow, filter: QueueFilter): boolean {
  if (filter === "awaiting") return row.state === "submitted" || row.state === "under_review";
  if (filter === "changes") return row.state === "more_information_required";
  if (filter === "review") return row.state === "under_review";
  if (filter === "escalated") return row.state === "escalated";
  return true;
}

export function ComplianceCentre({
  clientId,
  manager,
  synthetic = null,
  initialSection = "overview",
}: {
  clientId: string;
  manager: boolean;
  /** Development preview only. Live pages must not pass this. */
  synthetic?: CentrePayload | null;
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<"verify" | "reject" | "escalate" | null>(null);
  const [data, setData] = useState<CentrePayload | null>(synthetic);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(!synthetic);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [customerInstruction, setCustomerInstruction] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [policyKey, setPolicyKey] = useState("individual_purchaser");
  const [reviewNote, setReviewNote] = useState("");
  const [listingGate, setListingGate] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [evidence, setEvidence] = useState<Array<{ id: string; label: string; filename: string | null; uploadedAt: string; version: number; scanStatus: string; canOpen: boolean }>>([]);

  const apiSection = section === "requests" || section === "policies" || section === "audit" ? section : "overview";

  const load = useCallback(async () => {
    if (synthetic) {
      setData(synthetic);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/compliance/centre?section=${apiSection}&page=${page}`);
    const json = (await res.json().catch(() => ({}))) as CentrePayload;
    setLoading(false);
    if (res.status === 403) {
      setDenied(true);
      setData(null);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Compliance centre could not be loaded.");
      setData(json);
      return;
    }
    setDenied(false);
    setError(null);
    setData(json);
  }, [apiSection, clientId, page, synthetic]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const context = contextOf(section);
    const needle = query.trim().toLowerCase();
    return (data?.queue ?? []).filter((row) => {
      if (context && row.caseType !== context) return false;
      if (!matchesFilter(row, filter)) return false;
      if (!needle) return true;
      return `${row.caseType} ${row.requirement} ${requirementStateLabel(row.state)}`.toLowerCase().includes(needle);
    });
  }, [data?.queue, filter, query, section]);

  function selectRow(row: QueueRow) {
    setSelected(row);
    setReason("");
    setConfirming(null);
    setChangesOpen(false);
    setEvidence([]);
    if (synthetic) {
      setEvidence((data?.evidence ?? []).filter((item) => !item.caseId || item.caseId === row.caseId));
      return;
    }
    void fetch(`/api/clients/${clientId}/compliance/cases/${row.caseId}/evidence`).then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as { evidence?: typeof evidence };
      setEvidence(json.evidence ?? []);
    });
  }

  async function decide(decision: "verify" | "request_changes" | "reject" | "start_review") {
    if (!selected) return;
    if (decision === "request_changes" && customerInstruction.trim().length < 8) {
      setNotice("Write what the customer should correct. Internal notes are not sent.");
      return;
    }
    if (decision === "reject" && reason.trim().length < 3) {
      setNotice("Record what needs to change.");
      return;
    }
    if (synthetic) {
      setNotice("Synthetic preview. Nothing was saved.");
      setChangesOpen(false);
      return;
    }
    if ((decision === "verify" || decision === "reject") && confirming !== decision) {
      setConfirming(decision);
      setNotice(decision === "verify" ? "Confirm verification. An upload alone does not verify the requirement." : "Confirm rejection. The earlier evidence stays in the history.");
      return;
    }
    setConfirming(null);
    setBusy(decision);
    setNotice(null);
    const res = await fetch(`/api/clients/${clientId}/compliance/centre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decide", requirementId: selected.id, expectedState: selected.state === "escalated" ? "submitted" : selected.state, decision, reason: decision === "request_changes" ? customerInstruction : reason, customerInstruction: decision === "request_changes" ? customerInstruction : undefined, internalNote: decision === "request_changes" ? internalNote : undefined }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setNotice(json.error ?? "The decision was not saved.");
      return;
    }
    const delivery = json as { delivery?: { delivered?: boolean }; deliveryError?: string | null };
    setNotice(decision === "request_changes"
      ? (delivery.delivery?.delivered ? "Changes requested. A correction link was emailed. The code does not verify legal identity." : delivery.deliveryError ?? "The decision was saved. A correction email was not sent.")
      : decision === "verify" ? "Requirement verified." : "Decision recorded.");
    setSelected(null);
    setReason("");
    setCustomerInstruction("");
    setInternalNote("");
    setChangesOpen(false);
    await load();
  }

  async function escalate() {
    if (!selected) return;
    if (synthetic) {
      setNotice("Synthetic preview. Nothing was saved.");
      return;
    }
    if (reason.trim().length < 8) {
      setNotice("Record why this needs a restricted review. Use at least 8 characters.");
      return;
    }
    if (confirming !== "escalate") {
      setConfirming("escalate");
      setNotice("Confirm escalation. Sales staff will see only that additional review is required.");
      return;
    }
    setConfirming(null);
    setBusy("escalate");
    const res = await fetch(`/api/clients/${clientId}/compliance/centre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "escalate", caseId: selected.caseId, reason }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setNotice(json.error ?? "The escalation was not saved.");
      return;
    }
    setNotice("Escalation recorded for authorised reviewers.");
    setSelected(null);
    setReason("");
    await load();
  }

  async function savePolicy(activate: boolean) {
    if (synthetic) {
      setNotice("Synthetic preview. A policy was not saved.");
      return;
    }
    setBusy("policy");
    const res = await fetch(`/api/clients/${clientId}/compliance/centre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_policy", templateKey: policyKey, reviewNote, activate, listingPublication: listingGate, allowReuse: false }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    setNotice(res.ok ? (activate ? "Policy version activated for this organisation." : "Policy version saved for review.") : json.error ?? "Policy was not saved.");
    if (res.ok) await load();
  }

  if (denied) {
    return <ReErrorState title="You don't have permission to review this case" description="Ask a manager if your role should include compliance." />;
  }

  const pending = data?.counts?.pendingReviews ?? 0;
  const changes = data?.counts?.changesRequested ?? 0;
  const showQueue = section !== "requests" && section !== "policies" && section !== "audit";
  const nav = NAV.filter((item) => manager || !item.managerOnly);

  return (
    <div className="sales-dashboard-premium space-y-5 text-sales-text-primary">
      {synthetic ? <p className="text-[12px] font-medium text-sales-text-muted">Synthetic preview. These rows are not live cases and decisions are not saved.</p> : null}
      <RePageHeader
        context={manager ? "Compliance" : "Your follow-ups"}
        title="Compliance Centre"
        description="Review documentation, manage verification and resolve outstanding requirements."
        mobileTitle
      />
      <nav aria-label="Compliance" className="-mt-1 flex gap-4 overflow-x-auto border-b border-sales-border">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={section === item.id ? "page" : undefined}
            className={`re-focus min-h-11 shrink-0 border-b-2 px-0.5 text-[13px] font-medium ${section === item.id ? "border-sales-text-primary text-sales-text-primary" : "border-transparent text-sales-text-muted"}`}
            onClick={() => { setSection(item.id); setSelected(null); setFilter("all"); setPage(1); }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {notice ? <p className="text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
      {error ? <ReErrorState title="Compliance data is unavailable" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading compliance" /> : null}

      {showQueue && !loading ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {section === "overview" ? (
              <div className="mb-5 grid gap-6 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div>
                  <p className="font-display text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
                    {pending === 0 ? "Nothing is waiting for review." : `${pending} ${pending === 1 ? "item is" : "items are"} awaiting review.`}
                  </p>
                  <p className="mt-1 max-w-[42ch] text-[13px] leading-5 text-sales-text-secondary">
                    {pending === 0 ? "New submissions appear here after a buyer, seller or agent sends evidence." : "Open the next requirement. An uploaded file is not verified until you record a decision."}
                  </p>
                </div>
                <div className="border-t border-sales-border pt-3 text-[13px] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <p className="font-medium">Also open</p>
                  <p className="mt-1 text-sales-text-secondary">{changes === 0 ? "No changes are waiting on a customer." : `${changes} ${changes === 1 ? "change is" : "changes are"} waiting on the customer.`}</p>
                  {manager && (data?.counts?.escalated ?? 0) > 0 ? <p className="mt-1 text-sales-text-secondary">{data?.counts?.escalated} escalated {data?.counts?.escalated === 1 ? "case is" : "cases are"} restricted to reviewers.</p> : null}
                </div>
              </div>
            ) : null}

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3 overflow-x-auto text-[13px]" role="tablist" aria-label="Queue filter">
                {([
                  ["all", "All"],
                  ["awaiting", "Awaiting review"],
                  ["changes", "Changes requested"],
                  ["review", "In review"],
                  ...(manager ? [["escalated", "Escalated"] as const] : []),
                ] as Array<[QueueFilter, string]>).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={filter === id} className={`re-focus min-h-11 shrink-0 ${filter === id ? "font-semibold text-sales-text-primary" : "text-sales-text-muted"}`} onClick={() => setFilter(id)}>{label}</button>
                ))}
              </div>
              <label className="sr-only" htmlFor="queue-search">Search the queue</label>
              <input id="queue-search" className="min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] sm:max-w-[220px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requirement" />
            </div>

            {rows.length === 0 ? (
              <ReEmptyState icon={pending === 0 && !query ? <ShieldCheck /> : <SearchX />} title={pending === 0 && !query ? "You're up to date" : "No matching requirements"} description={pending === 0 && !query ? "There are no cases awaiting your review." : "Try another filter or search."} />
            ) : (
              <>
                <ul className="divide-y divide-sales-border md:hidden">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button type="button" className="re-focus flex w-full min-h-11 flex-col items-start gap-0.5 py-3 text-left" aria-pressed={selected?.id === row.id} onClick={() => selectRow(row)}>
                        <span className="text-[14px] font-semibold">{row.requirement}</span>
                        <span className="text-[12px] text-sales-text-muted">{caseTypeLabel(row.caseType)} · {requirementStateLabel(row.state)} · {waitingLabel(row.submittedAt) || "Submitted"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <table className="hidden w-full table-fixed text-left text-[13px] md:table">
                  <thead className="text-[12px] text-sales-text-muted">
                    <tr>
                      <th className="w-[14%] py-2 pr-3 font-medium">Subject</th>
                      <th className="w-[32%] py-2 pr-3 font-medium">Requirement</th>
                      <th className="w-[16%] py-2 pr-3 font-medium">Submitted</th>
                      <th className="w-[22%] py-2 pr-3 font-medium">Status</th>
                      <th className="w-[16%] py-2 font-medium">Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className={`border-t border-sales-border ${selected?.id === row.id ? "bg-sales-surface-selected" : ""}`}>
                        <td className="py-2.5 pr-3 align-top">{caseTypeLabel(row.caseType)}</td>
                        <td className="py-2.5 pr-3 align-top font-medium">{row.requirement}</td>
                        <td className="py-2.5 pr-3 align-top text-sales-text-muted">{waitingLabel(row.submittedAt) || "—"}</td>
                        <td className="py-2.5 pr-3 align-top"><ReStatusBadge tone={requirementTone(row.state)} label={requirementStateLabel(row.state)} /></td>
                        <td className="py-2.5 align-top">
                          <button type="button" className="re-focus min-h-11 font-semibold" onClick={() => selectRow(row)}>Open review</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {data?.hasMore || page > 1 ? (
            <div className="mt-3 flex gap-3 text-[13px]">
              <button type="button" className="re-focus min-h-11 font-semibold disabled:text-sales-text-muted" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <button type="button" className="re-focus min-h-11 font-semibold disabled:text-sales-text-muted" disabled={!data?.hasMore} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          ) : null}
          <aside className="border-t border-sales-border pt-4 lg:sticky lg:top-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            {selected ? (
              <div>
                <p className="text-[12px] text-sales-text-muted">{caseTypeLabel(selected.caseType)}</p>
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">{selected.requirement}</h2>
                <p className="mt-1 text-[13px] text-sales-text-secondary">{requirementStateLabel(selected.state)}. {selected.nextAction}</p>
                <p className="mt-3 text-[12px] leading-5 text-sales-text-muted">Files stay private. An unscanned file is quarantined and cannot be opened. Opening a cleared file does not verify the requirement.</p>
                {evidence.length > 0 ? (
                  <ul className="mt-3 divide-y divide-sales-border text-[13px]">
                    {evidence.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          <span className="font-medium">{item.label}</span>
                          <span className="block text-[12px] text-sales-text-muted">{item.filename ?? "File"} · version {item.version} · {scanStatusLabel(item.scanStatus)}</span>
                        </span>
                        <button type="button" className="re-focus min-h-11 shrink-0 font-semibold disabled:text-sales-text-muted" disabled={!item.canOpen} onClick={() => {
                          if (!selected) return;
                          if (synthetic) {
                            setNotice("Synthetic preview. No file is opened.");
                            return;
                          }
                          void fetch(`/api/clients/${clientId}/compliance/cases/${selected.caseId}/evidence/${item.id}`).then(async (res) => {
                            const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
                            if (!res.ok || !body.url) {
                              setNotice(body.error ?? "The file cannot be opened.");
                              return;
                            }
                            window.open(body.url, "_blank", "noopener,noreferrer");
                          });
                        }}>Open</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-[13px] text-sales-text-muted">No submitted file is attached to this case yet.</p>}
                <label className="mt-4 block text-[13px] font-medium" htmlFor="decision-reason">Note for the customer, when you request a change or reject</label>
                <textarea id="decision-reason" className="mt-1 min-h-24 w-full rounded-[8px] border border-sales-border bg-sales-surface p-3 text-[14px]" value={reason} onChange={(event) => setReason(event.target.value)} />
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" className="re-focus min-h-11 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50" disabled={busy !== null || !data?.canReview} onClick={() => void decide("verify")}>{busy === "verify" ? "Saving…" : confirming === "verify" ? "Confirm verify" : "Verify"}</button>
                  <button type="button" className="re-focus min-h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold disabled:opacity-50" disabled={busy !== null || !data?.canReview} onClick={() => setChangesOpen(true)}>Request changes</button>
                  <button type="button" className="re-focus min-h-11 rounded-[8px] px-3 text-[13px] font-semibold text-sales-danger-fg disabled:opacity-50" disabled={busy !== null || !data?.canReview} onClick={() => void decide("reject")}>{confirming === "reject" ? "Confirm reject" : "Reject"}</button>
                  {manager ? <button type="button" className="re-focus min-h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold disabled:opacity-50" disabled={busy !== null} onClick={() => void escalate()}>{confirming === "escalate" ? "Confirm escalation" : "Escalate"}</button> : null}
                  <button type="button" className="re-focus min-h-11 text-[13px] text-sales-text-muted" onClick={() => setSelected(null)}>Close</button>
                </div>
                {!data?.canReview ? <p className="mt-2 text-[13px] text-sales-text-muted">Your role can follow the queue. A compliance reviewer records the decision.</p> : null}
              </div>
            ) : (
              <p className="text-[13px] leading-5 text-sales-text-secondary">Select a requirement to review it. The decision is saved only after the server confirms it.</p>
            )}
          </aside>
        </div>
      ) : null}

      {changesOpen && selected ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation">
          <form
            role="dialog"
            aria-labelledby="changes-title"
            className="w-full max-w-md rounded-[12px] bg-sales-surface p-4 shadow-sm"
            onSubmit={(event) => { event.preventDefault(); void decide("request_changes"); }}
          >
            <h2 id="changes-title" className="font-display text-[17px] font-semibold">Request changes</h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">The customer sees only the correction instruction. The internal note stays with the review team.</p>
            <label className="mt-3 block text-[13px] font-medium" htmlFor="changes-customer">What the customer should correct</label>
            <textarea id="changes-customer" required minLength={8} className="mt-1 min-h-24 w-full rounded-[8px] border border-sales-border p-3 text-[14px]" value={customerInstruction} onChange={(event) => setCustomerInstruction(event.target.value)} />
            <label className="mt-3 block text-[13px] font-medium" htmlFor="changes-internal">Internal note</label>
            <textarea id="changes-internal" className="mt-1 min-h-20 w-full rounded-[8px] border border-sales-border p-3 text-[14px]" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="re-focus min-h-11 px-3 text-[13px]" onClick={() => setChangesOpen(false)}>Cancel</button>
              <button type="submit" className="re-focus min-h-11 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" disabled={busy !== null}>{busy === "request_changes" ? "Saving…" : "Send request"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {section === "requests" && !loading ? (
        <section>
          <h2 className="font-display text-[17px] font-semibold">Document requests</h2>
          <p className="mt-1 max-w-[62ch] text-[13px] text-sales-text-secondary">A link is created before it is sent. Delivery is recorded only when Resend accepts the message. The customer still enters a code before the form opens.</p>
          {(data?.requests?.length ?? 0) === 0 ? <div className="mt-4"><ReEmptyState icon={<FileText />} title="No document requests yet" description="Request documents from a buyer, seller or transaction." /></div> : (
            <>
            <ul className="mt-3 divide-y divide-sales-border md:hidden">
              {data?.requests?.map((request) => (
                <li key={request.id} className="py-3 text-[13px]">
                  <p className="font-semibold capitalize">{words(request.purpose)}</p>
                  <p className="text-[12px] text-sales-text-muted">{caseTypeLabel(request.caseType)} · {invitationStatusLabel(request.status)}{request.expiresAt ? ` · Expires ${new Date(request.expiresAt).toLocaleDateString()}` : ""}</p>
                </li>
              ))}
            </ul>
            <table className="mt-4 hidden w-full text-left text-[13px] md:table">
              <thead className="text-[12px] text-sales-text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Case</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="hidden py-2 font-medium sm:table-cell">Expires</th>
                </tr>
              </thead>
              <tbody>
                {data?.requests?.map((request) => (
                  <tr key={request.id} className="border-t border-sales-border">
                    <td className="py-2.5 pr-3">{caseTypeLabel(request.caseType)}</td>
                    <td className="py-2.5 pr-3 capitalize">{words(request.purpose)}</td>
                    <td className="py-2.5 pr-3"><ReStatusBadge tone={request.status === "expired" || request.status === "revoked" ? "warning" : "neutral"} label={invitationStatusLabel(request.status)} /></td>
                    <td className="hidden py-2.5 text-sales-text-muted sm:table-cell">{request.expiresAt ? new Date(request.expiresAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </section>
      ) : null}

      {section === "policies" && !loading ? (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div>
            <h2 className="font-display text-[17px] font-semibold">Saved versions</h2>
            {(data?.policies?.length ?? 0) === 0 ? <p className="mt-2 text-[13px] text-sales-text-secondary">No policy version has been saved.</p> : (
              <ul className="mt-3 divide-y divide-sales-border">
                {data?.policies?.map((policy) => (
                  <li key={policy.id} className="py-2 text-[13px]">
                    <p className="font-medium capitalize">{words(policy.template_key)}</p>
                    <p className="text-sales-text-muted">Version {policy.version} · {words(policy.status)}{policy.enforcement?.listing_publication ? " · listing gate on" : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void savePolicy(false); }}>
            <h2 className="font-display text-[17px] font-semibold">Review a checklist</h2>
            <p className="text-[13px] text-sales-text-secondary">Sample starting points stay inactive until a qualified reviewer records a note and activates a version. Activation does not rewrite existing cases.</p>
            <label className="block text-[13px] font-medium" htmlFor="policy-template">Template</label>
            <select id="policy-template" className="min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[14px]" value={policyKey} onChange={(event) => setPolicyKey(event.target.value)}>
              {(data?.templates ?? []).map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}
            </select>
            <p className="text-[13px] text-sales-text-secondary">{data?.templates?.find((template) => template.key === policyKey)?.disclaimer}</p>
            <label className="block text-[13px] font-medium" htmlFor="policy-note">Review note</label>
            <textarea id="policy-note" required minLength={8} className="min-h-24 w-full rounded-[8px] border border-sales-border bg-sales-surface p-3 text-[14px]" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Who reviewed this checklist and the limits of its use" />
            <label className="flex min-h-11 items-center gap-2 text-[13px]">
              <input type="checkbox" checked={listingGate} onChange={(event) => setListingGate(event.target.checked)} />
              Block public marketing until listing readiness is approved
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="re-focus min-h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" disabled={!manager || busy !== null}>Save for review</button>
              <button type="button" className="re-focus min-h-11 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" disabled={!manager || busy !== null} onClick={() => void savePolicy(true)}>Activate version</button>
            </div>
          </form>
        </section>
      ) : null}

      {section === "audit" && !loading ? (
        <section>
          <h2 className="font-display text-[17px] font-semibold">Audit log</h2>
          <p className="mt-1 max-w-[62ch] text-[13px] text-sales-text-secondary">Entries describe the action. They do not copy identity numbers or document contents.</p>
          {(data?.events?.length ?? 0) === 0 ? <div className="mt-4"><ReEmptyState icon={<History />} title="No compliance events yet" description="Decisions and document requests will appear here." /></div> : (
            <ul className="mt-3 divide-y divide-sales-border">
              {data?.events?.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 py-2.5 text-[13px] sm:flex-row sm:items-baseline sm:justify-between">
                  <span>{event.summary}</span>
                  <time className="text-[12px] text-sales-text-muted" dateTime={event.at}>{event.at ? new Date(event.at).toLocaleString() : ""}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
