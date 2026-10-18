"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H5 E4 S4 R4 V4 */

import { useEffect, useState } from "react";
import { Button } from "@/components/sales/ui";
import {
  ReEmptyState,
  ReErrorState,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { strengthLabel } from "@/components/real-estate/buyers/IntroductionMatchStatus";

type Item = {
  id: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  legacyDecision: boolean;
  listingId: string;
  listingLabel: string;
  requestingAgentName: string;
  responsibleAgentName: string | null;
  unassigned: boolean;
  requirementsSummary: string;
  matchReasons: string[];
  strength: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  waitingCopy: string;
  canApprove: boolean;
  canDecline: boolean;
  ownRequest: boolean;
  contactName: string | null;
  phone: string | null;
};

function statusLabel(status: string): string {
  if (status === "accepted") return "Introduction approved";
  if (status === "declined") return "Introduction declined";
  return "Introduction pending";
}

function statusTone(status: string): "success" | "danger" | "warning" {
  if (status === "accepted") return "success";
  if (status === "declined") return "danger";
  return "warning";
}

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function IntroductionQueue({
  clientId,
  basePath,
  initialOpen,
}: {
  clientId: string;
  basePath: "/client" | "/sales";
  initialOpen?: string | null;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [confirm, setConfirm] = useState<"accepted" | "declined" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/introductions`);
    const json = (await res.json().catch(() => ({}))) as { items?: Item[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not load introduction requests.");
      setItems(null);
      return;
    }
    setItems(json.items ?? []);
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  const selected = items?.find((item) => item.id === openId) ?? null;
  const pending = (items ?? []).filter((item) => item.status === "requested");
  const decided = (items ?? []).filter((item) => item.status !== "requested");

  async function decide(decision: "accepted" | "declined") {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_introduction",
          introductionId: selected.id,
          decision,
          decisionReason: decision === "declined" ? reason.trim() || null : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(json.error ?? "The decision could not be saved.");
        return;
      }
      setConfirm(null);
      setReason("");
      setOpenId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function open(item: Item) {
    setOpenId(item.id);
    setConfirm(null);
    setReason("");
    setActionError(null);
  }

  return (
    <div className="space-y-4">
      {!items && !error ? <ReSkeletonRows rows={3} label="Loading introduction requests" /> : null}
      {error ? <ReErrorState title="Introductions could not be loaded" description={error} onRetry={() => void load()} /> : null}
      {items && pending.length === 0 && decided.length === 0 ? (
        <ReEmptyState title="No introduction requests" description="Requests appear here when an agent asks to be introduced to a buyer." framed />
      ) : null}
      {pending.length ? (
        <ReSection id="pending-introductions" title="Pending introductions" count={pending.length}>
          <ul className="space-y-2">
            {pending.map((item) => (
              <li key={item.id}>
                <IntroductionCard item={item} onOpen={() => open(item)} />
              </li>
            ))}
          </ul>
        </ReSection>
      ) : null}
      {decided.length ? (
        <ReSection id="decided-introductions" title="Decided introductions" count={decided.length}>
          <ul className="space-y-2">
            {decided.map((item) => (
              <li key={item.id}>
                <IntroductionCard item={item} onOpen={() => open(item)} />
              </li>
            ))}
          </ul>
        </ReSection>
      ) : null}
      {selected ? (
        <ReSheet
          title={selected.listingLabel}
          description={selected.ownRequest ? "Your request" : "Review this introduction"}
          onClose={() => {
            if (busy) return;
            setOpenId(null);
          }}
          footer={
            selected.canApprove || selected.canDecline ? (
              <div className="flex flex-col gap-2">
                {confirm === "accepted" ? (
                  <>
                    <p className="text-[13px] text-sales-text-secondary">Approve this introduction? The requester will see the authorised contact details for this property.</p>
                    <Button type="button" className="min-h-11 w-full" loading={busy} onClick={() => void decide("accepted")}>
                      Approve introduction
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 w-full" disabled={busy} onClick={() => setConfirm(null)}>
                      Back
                    </Button>
                  </>
                ) : confirm === "declined" ? (
                  <>
                    <label className="text-[13px] text-sales-text-secondary" htmlFor="decline-reason">
                      Reason, optional
                    </label>
                    <textarea
                      id="decline-reason"
                      value={reason}
                      maxLength={500}
                      onChange={(event) => setReason(event.target.value)}
                      className="min-h-20 w-full rounded-sales-sm border border-sales-border bg-sales-surface px-3 py-2 text-[14px] text-sales-text-primary"
                    />
                    <Button type="button" variant="danger" className="min-h-11 w-full" loading={busy} onClick={() => void decide("declined")}>
                      Decline introduction
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 w-full" disabled={busy} onClick={() => setConfirm(null)}>
                      Back
                    </Button>
                  </>
                ) : (
                  <>
                    {selected.canApprove ? (
                      <Button type="button" className="min-h-11 w-full" onClick={() => setConfirm("accepted")}>
                        Approve introduction
                      </Button>
                    ) : null}
                    {selected.canDecline ? (
                      <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={() => setConfirm("declined")}>
                        Decline introduction
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null
          }
        >
          <div className="space-y-3 text-[14px]">
            <ReStatusBadge label={statusLabel(selected.status)} tone={statusTone(selected.status)} />
            {!selected.eligible && selected.status === "requested" ? (
              <p className="text-sales-text-secondary">{selected.eligibilityReason}</p>
            ) : null}
            {selected.status === "requested" ? <p className="text-sales-text-secondary">{selected.waitingCopy}</p> : null}
            <p className="text-sales-text-secondary">Requested by {selected.requestingAgentName} on {when(selected.createdAt)}</p>
            <p className="text-sales-text-secondary">
              {selected.unassigned ? "No agent is assigned to this buyer." : `Responsible agent: ${selected.responsibleAgentName}`}
            </p>
            <p>{selected.requirementsSummary}</p>
            {selected.matchReasons.length ? <p className="text-sales-text-secondary">{selected.matchReasons.slice(0, 3).join(" · ")}</p> : null}
            {selected.strength ? <ReStatusBadge label={strengthLabel(selected.strength)} /> : null}
            {selected.contactName ? <p className="font-semibold [overflow-wrap:anywhere]">{selected.contactName}</p> : null}
            {selected.phone ? <p>{selected.phone}</p> : null}
            {selected.ownRequest && selected.status !== "accepted" ? (
              <p className="text-sales-text-secondary">Buyer details stay private until a reviewer approves this request.</p>
            ) : null}
            {selected.legacyDecision ? <p className="text-[13px] text-sales-text-muted">This decision was recorded before reviewer history was stored.</p> : null}
            {selected.decidedAt ? <p className="text-[13px] text-sales-text-muted">Decided {when(selected.decidedAt)}</p> : null}
            <a className="re-focus inline-flex min-h-11 items-center font-semibold text-sales-brand" href={basePath === "/client" ? `${basePath}/listings/${selected.listingId}` : `${basePath}/listings`}>
              View property
            </a>
            {actionError ? (
              <p className="text-[13px] text-sales-danger-fg" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
        </ReSheet>
      ) : null}
    </div>
  );
}

function IntroductionCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <article className="rounded-[12px] border border-sales-border-subtle px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold text-sales-text-primary [overflow-wrap:anywhere]">{item.listingLabel}</h3>
        <ReStatusBadge label={statusLabel(item.status)} tone={statusTone(item.status)} />
      </div>
      <p className="mt-1 text-[13px] text-sales-text-secondary">Requested by {item.requestingAgentName}</p>
      <p className="text-[13px] text-sales-text-secondary">
        {item.unassigned ? "Unassigned buyer" : `Responsible agent: ${item.responsibleAgentName}`}
      </p>
      <p className="mt-1 text-[13px] text-sales-text-secondary">{item.requirementsSummary}</p>
      <p className="mt-1 text-[12px] text-sales-text-muted">{when(item.createdAt)}</p>
      {!item.eligible && item.status === "requested" ? <p className="mt-1 text-[13px] text-sales-text-secondary">{item.eligibilityReason}</p> : null}
      <button type="button" className="re-focus mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand" onClick={onOpen}>
        {item.canApprove || item.canDecline ? "Review" : "View"}
      </button>
    </article>
  );
}
