"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Badge, Button, Field, IconButton, Input, TextArea } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  allowedOfferActions,
  formatOfferMoney,
  isOfferEditable,
  isOfferLocked,
  offerVsAsking,
  RE_OFFER_EVENT_LABEL,
  RE_OFFER_REJECT_REASONS,
  reOfferStatusLabel,
  type ReOfferAction,
  type ReOfferStatus,
} from "@/lib/real-estate/offers";
import type { OfferEventRow, OfferListRow } from "@/lib/real-estate/offer-service";
import type { CreateOfferPrefill } from "./CreateOfferSheet";
import { ComplianceCasePanel } from "@/components/real-estate/compliance/ComplianceCasePanel";

type OfferTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export function OfferStatusPill({ status }: { status: string }) {
  const tone: OfferTone =
    status === "accepted"
      ? "success"
      : status === "rejected" || status === "withdrawn" || status === "expired"
        ? "danger"
        : status === "submitted"
          ? "warning"
          : status === "countered" || status === "negotiating"
            ? "brand"
            : "neutral";
  const appearance = status === "rejected" ? "danger" : tone;
  return (
    <Badge tone={appearance === "danger" && status === "withdrawn" ? "neutral" : tone} appearance="soft">
      {reOfferStatusLabel(status)}
    </Badge>
  );
}

type DetailPayload = {
  offer: Record<string, unknown>;
  events: OfferEventRow[];
  listing: {
    id: string;
    address?: string | null;
    suburb?: string | null;
    price?: number | null;
    status?: string;
  } | null;
  contact: { id: string; name?: string | null; phone?: string | null; email?: string | null } | null;
  siblingActive: OfferListRow[];
  commission: { listingPct: number | null; sellingPct: number | null } | null;
};

export function OfferDetailPanel({
  clientId,
  offerId,
  complianceHref,
  onClose,
  onChanged,
  overlay = true,
  stacked = false,
}: {
  clientId: string;
  offerId: string;
  complianceHref: string | null;
  onClose: () => void;
  onChanged: () => void;
  overlay?: boolean;
  stacked?: boolean;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ReOfferAction | "seller" | "accept_confirm" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notifyAvailable, setNotifyAvailable] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<{
    id: string;
    status: string;
    statusLabel: string;
    docsReceived: number;
    docsRequired: number;
    approvedAt: string | null;
  } | null>(null);
  const [startingCdd, setStartingCdd] = useState(false);

  async function loadCompliance() {
    const res = await fetch(
      `/api/clients/${clientId}/compliance/cases?offer_id=${encodeURIComponent(offerId)}&tab=all`
    );
    const j = (await res.json()) as {
      cases?: Array<{
        id: string;
        status: string;
        statusLabel: string;
        docsReceived: number;
        docsRequired: number;
        approvedAt: string | null;
      }>;
    };
    const row = j.cases?.[0] ?? null;
    setComplianceSummary(row);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/offers/${offerId}`);
      const j = (await res.json()) as DetailPayload & { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Could not load offer.");
        setData(null);
        return;
      }
      setData(j);
      void loadCompliance();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, offerId]);

  const offer = data?.offer;
  const status = (offer?.status as ReOfferStatus) ?? "draft";
  const currency = (offer?.currency as string) ?? "USD";
  const actions = allowedOfferActions(status);
  const listingPrice = data?.listing?.price != null ? Number(data.listing.price) : null;
  const current = offer ? Number(offer.current_offer_amount) : 0;
  const original = offer ? Number(offer.original_offer_amount) : 0;

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          expected_updated_at: offer?.updated_at ?? null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        notifyAvailable?: boolean;
        siblingActiveCount?: number;
      };
      if (!res.ok) {
        setToast(j.error ?? "Update failed.");
        return;
      }
      setNotifyAvailable(Boolean(j.notifyAvailable));
      setAction(null);
      setAmount("");
      setNote("");
      setReason("");
      await load();
      onChanged();
      if ((j.siblingActiveCount ?? 0) > 0 && body.action === "accept") {
        setToast(`Offer accepted. This property has ${j.siblingActiveCount} other active offer(s).`);
      } else {
        setToast("Offer updated successfully.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsApp() {
    const res = await fetch(`/api/clients/${clientId}/offers/${offerId}/notify`, { method: "POST" });
    const j = (await res.json().catch(() => ({}))) as { sent?: boolean };
    setToast(j.sent ? "WhatsApp update sent." : "WhatsApp could not be sent. The offer was not changed.");
    setNotifyAvailable(false);
  }

  async function startCompliance() {
    const contactId = data?.contact?.id;
    if (!contactId) return;
    setStartingCdd(true);
    setToast(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/compliance/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          offer_id: offerId,
          listing_id: data?.listing?.id ?? null,
          lead_id: (offer?.lead_id as string | null) ?? null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; case?: { id: string } };
      if (!res.ok || !j.case?.id) {
        setToast(j.error ?? "Could not start compliance.");
        return;
      }
      setCaseId(j.case.id);
      await loadCompliance();
    } finally {
      setStartingCdd(false);
    }
  }

  return (
    <>
    {overlay ? (
      <button
        type="button"
        aria-label="Close offer details"
        className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
    ) : null}
    <aside
      className={cn(
        "flex h-full min-h-[660px] flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
        overlay &&
          "fixed inset-y-0 right-0 z-[70] w-full max-w-[560px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
        stacked && overlay && "inset-0 max-w-none rounded-none"
      )}
    >
        <header className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">Offer</p>
            <h2 className="truncate text-[18px] font-semibold tracking-[-0.03em]">
              {data?.listing ? listingLabel(data.listing) : "Offer"}
            </h2>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">
              Offer from {data?.contact?.name ?? "buyer"}
            </p>
          </div>
          <IconButton aria-label="Close offer details" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? <p className="text-[13px] text-sales-text-muted">Loading…</p> : null}
          {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
          {toast ? (
            <div className="mb-4 rounded-[10px] border border-sales-border bg-sales-neutral-50 px-3 py-2 text-[13px]">
              <p>{toast}</p>
              {notifyAvailable ? (
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => void sendWhatsApp()}>
                  Send update via WhatsApp
                </Button>
              ) : null}
            </div>
          ) : null}

          {offer ? (
            <div className="space-y-6">
              <section>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                      Current offer
                    </p>
                    <p className="text-[28px] font-semibold tabular-nums tracking-[-0.04em]">
                      {formatOfferMoney(current, currency)}
                    </p>
                  </div>
                  <OfferStatusPill status={status} />
                </div>
                <p className="mt-1 text-[13px] text-sales-text-secondary">
                  Agent: {(offer.buyer_agent_name as string | null) ?? "Unassigned"}
                </p>
              </section>

              {status === "accepted" ? (
                <section className="rounded-[12px] border border-sales-border bg-sales-neutral-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                    Next step
                  </p>
                  {complianceSummary ? (
                    <>
                      <p className="mt-1 text-[14px] font-medium">
                        Compliance
                        {complianceSummary.status === "approved" ? " ✓ Approved" : ` · ${complianceSummary.statusLabel}`}
                      </p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">
                        Documents {complianceSummary.docsReceived} of {complianceSummary.docsRequired} received
                      </p>
                      {complianceSummary.approvedAt ? (
                        <p className="mt-1 text-[12px] text-sales-text-muted">
                          {new Date(complianceSummary.approvedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                      {complianceSummary.status === "restricted" || complianceSummary.status === "rejected" ? (
                        <p className="mt-2 text-[12px] text-sales-text-secondary">
                          Compliance review required before this transaction can proceed.
                        </p>
                      ) : null}
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setCaseId(complianceSummary.id)}
                      >
                        Open CDD
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-[14px] font-medium">Client Due Diligence</p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">
                        CDD has not started. An accepted offer is not a completed sale.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-3"
                        disabled={startingCdd || !data.contact?.id}
                        onClick={() => void startCompliance()}
                      >
                        {startingCdd ? "Starting…" : "Start compliance"}
                      </Button>
                    </>
                  )}
                  {complianceHref ? (
                    <Link
                      href={complianceHref}
                      className="mt-3 block text-[12px] font-medium text-sales-text-secondary hover:underline"
                    >
                      Open compliance workspace
                    </Link>
                  ) : null}
                </section>
              ) : null}

              {data.siblingActive.length > 0 ? (
                <section className="rounded-[12px] border border-sales-warning/35 bg-sales-warning-soft p-3">
                  <p className="text-[13px] font-medium">
                    This property has {data.siblingActive.length} other active offer
                    {data.siblingActive.length === 1 ? "" : "s"}.
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px] text-sales-text-secondary">
                    {data.siblingActive.map((s) => (
                      <li key={s.id}>
                        {s.buyerName ?? "Buyer"} · {s.currentAmountLabel} · {s.statusLabel}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h3 className="text-[13px] font-semibold">Overview</h3>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                  <div>
                    <dt className="text-sales-text-muted">Listing price</dt>
                    <dd className="font-medium tabular-nums">
                      {listingPrice != null ? formatOfferMoney(listingPrice, currency) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sales-text-muted">Original offer</dt>
                    <dd className="font-medium tabular-nums">{formatOfferMoney(original, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-sales-text-muted">vs asking</dt>
                    <dd className="font-medium">{offerVsAsking(current, listingPrice) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sales-text-muted">Submitted</dt>
                    <dd>{offer.submitted_at ? new Date(String(offer.submitted_at)).toLocaleString("en-GB") : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sales-text-muted">Expiry</dt>
                    <dd>{offer.expiry_date ? String(offer.expiry_date) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sales-text-muted">Listing status</dt>
                    <dd className="capitalize">{String(data.listing?.status ?? "—").replace(/_/g, " ")}</dd>
                  </div>
                </dl>
                {offer.conditions ? (
                  <p className="mt-3 text-[13px] text-sales-text-secondary">
                    <span className="font-medium text-sales-text-primary">Conditions: </span>
                    {String(offer.conditions)}
                  </p>
                ) : null}
                {data.commission && (data.commission.listingPct != null || data.commission.sellingPct != null) ? (
                  <p className="mt-2 text-[12px] text-sales-text-muted">
                    Commission (lead snapshot): listing {data.commission.listingPct ?? "—"}% · selling{" "}
                    {data.commission.sellingPct ?? "—"}%
                  </p>
                ) : null}
              </section>

              <section>
                <h3 className="text-[13px] font-semibold">Negotiation</h3>
                <ol className="mt-3 space-y-3 border-l border-sales-border-subtle pl-4">
                  {(data.events ?? []).map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-sales-text-muted" />
                      <p className="text-[11px] text-sales-text-muted">
                        {new Date(ev.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {ev.createdByName ? ` · ${ev.createdByName}` : ""}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide">
                        {RE_OFFER_EVENT_LABEL[ev.eventType] ?? ev.label}
                      </p>
                      {ev.amountLabel ? (
                        <p className="text-[16px] font-semibold tabular-nums">{ev.amountLabel}</p>
                      ) : null}
                      {ev.note ? <p className="text-[13px] text-sales-text-secondary">{ev.note}</p> : null}
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold">Buyer</h3>
                <p className="mt-1 text-[14px] font-medium">{data.contact?.name ?? "—"}</p>
                <p className="text-[13px] text-sales-text-secondary">
                  {[data.contact?.phone, data.contact?.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold">Property</h3>
                {data.listing ? (
                  <Link
                    href={`/client/listings/${data.listing.id}`}
                    className="mt-1 inline-block text-[14px] font-medium hover:underline"
                  >
                    {listingLabel(data.listing)}
                  </Link>
                ) : (
                  <p className="text-[13px] text-sales-text-muted">Listing unavailable.</p>
                )}
                {data.listing?.status === "under_offer" ? (
                  <p className="mt-1 text-[12px] font-medium text-sales-warning-fg">Under offer</p>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        {offer && !isOfferLocked(status) ? (
          <div className="border-t border-sales-border-subtle px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {actions.includes("submit") ? (
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void mutate({ action: "submit" })}>
                  Submit offer
                </Button>
              ) : null}
              {actions.includes("counter") ? (
                <Button variant="secondary" size="sm" onClick={() => setAction("seller")}>
                  Record seller response
                </Button>
              ) : null}
              {actions.includes("revise") ? (
                <Button variant="secondary" size="sm" onClick={() => setAction("revise")}>
                  Buyer revised offer
                </Button>
              ) : null}
              {actions.includes("accept") ? (
                <Button variant="success" size="sm" onClick={() => setAction("accept_confirm")}>
                  Accept
                </Button>
              ) : null}
              {actions.includes("reject") ? (
                <Button variant="danger" size="sm" onClick={() => setAction("reject")}>
                  Reject
                </Button>
              ) : null}
              {actions.includes("withdraw") ? (
                <Button variant="ghost" size="sm" onClick={() => setAction("withdraw")}>
                  Withdraw
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setAction("note")}>
                Add note
              </Button>
            </div>
          </div>
        ) : offer && isOfferLocked(status) ? (
          <div className="border-t border-sales-border-subtle px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setAction("note")}>
              Add note
            </Button>
            {isOfferEditable(status) ? null : (
              <p className="mt-1 text-[11px] text-sales-text-muted">
                Amount changes are recorded as negotiation events. Direct edits are locked.
              </p>
            )}
          </div>
        ) : null}

        {action === "seller" ? (
          <ActionSheet title="Record seller response" onClose={() => setAction(null)}>
            <div className="flex flex-col gap-2">
              <Button
                variant="success"
                onClick={() => {
                  setAction("accept_confirm");
                }}
              >
                Accept offer
              </Button>
              <Button variant="danger" onClick={() => setAction("reject")}>
                Reject offer
              </Button>
              <Button variant="secondary" onClick={() => setAction("counter")}>
                Counter offer
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void mutate({ action: "note", note: "Seller needs more time." })}
              >
                Needs more time
              </Button>
            </div>
          </ActionSheet>
        ) : null}

        {action === "counter" ? (
          <ActionSheet title="Seller counter" onClose={() => setAction(null)}>
            <Field label="Counter amount">
              <Input
                className="h-12 text-[18px] font-semibold tabular-nums"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Seller notes / conditions" className="mt-3">
              <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                void mutate({ action: "counter", amount: Number(amount), note: note || null, conditions: note || undefined })
              }
            >
              Record counter
            </Button>
          </ActionSheet>
        ) : null}

        {action === "revise" ? (
          <ActionSheet title="Buyer revised offer" onClose={() => setAction(null)}>
            <Field label="New amount">
              <Input
                className="h-12 text-[18px] font-semibold tabular-nums"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Conditions / notes" className="mt-3">
              <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                void mutate({
                  action: "revise",
                  amount: Number(amount),
                  note: note || null,
                  conditions: note || undefined,
                })
              }
            >
              Record revision
            </Button>
          </ActionSheet>
        ) : null}

        {action === "accept_confirm" ? (
          <ActionSheet title="Confirm acceptance" onClose={() => setAction(null)}>
            <p className="text-[13px] text-sales-text-secondary">
              Accepting this offer will mark it as accepted and may update the property to Under Offer.
              This is not a completed sale.
            </p>
            <dl className="mt-3 space-y-1 text-[13px]">
              <div className="flex justify-between">
                <dt>Property</dt>
                <dd className="font-medium">{data?.listing ? listingLabel(data.listing) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Buyer</dt>
                <dd className="font-medium">{data?.contact?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Agreed amount</dt>
                <dd className="font-semibold tabular-nums">{formatOfferMoney(current, currency)}</dd>
              </div>
            </dl>
            {offer?.conditions ? (
              <p className="mt-2 text-[12px] text-sales-text-secondary">Terms: {String(offer.conditions)}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button
                variant="success"
                className="flex-1"
                disabled={busy}
                onClick={() => void mutate({ action: "accept", amount: current })}
              >
                Confirm acceptance
              </Button>
            </div>
          </ActionSheet>
        ) : null}

        {action === "reject" ? (
          <ActionSheet title="Reject offer" onClose={() => setAction(null)}>
            <Field label="Reason">
              <div className="flex flex-wrap gap-1.5">
                {RE_OFFER_REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[12px] ${
                      reason === r ? "border-sales-brand-border bg-sales-brand-soft" : "border-sales-border"
                    }`}
                    onClick={() => setReason(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <TextArea
                className="mt-3"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Additional detail"
              />
            </Field>
            <Button
              variant="danger"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => void mutate({ action: "reject", reason: note || reason || "Other" })}
            >
              Confirm rejection
            </Button>
          </ActionSheet>
        ) : null}

        {action === "withdraw" ? (
          <ActionSheet title="Withdraw offer" onClose={() => setAction(null)}>
            <TextArea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason (optional)"
            />
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => void mutate({ action: "withdraw", note: note || null })}
            >
              Confirm withdrawal
            </Button>
          </ActionSheet>
        ) : null}

        {action === "note" ? (
          <ActionSheet title="Add note" onClose={() => setAction(null)}>
            <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={busy || !note.trim()}
              onClick={() => void mutate({ action: "note", note })}
            >
              Save note
            </Button>
          </ActionSheet>
        ) : null}
    </aside>
      {caseId ? (
        <ComplianceCasePanel
          clientId={clientId}
          caseId={caseId}
          onClose={() => {
            setCaseId(null);
            void loadCompliance();
          }}
          onChanged={() => void loadCompliance()}
        />
      ) : null}
    </>
  );
}

function ActionSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[90] rounded-t-[16px] border border-sales-border bg-sales-surface p-4 shadow-sales-modal">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-semibold">{title}</p>
        <button type="button" className="text-[12px] text-sales-text-muted" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

export function InquiryOffersSection({
  clientId,
  leadId,
  contactId,
  contactName,
  defaultListingId,
  onOpen,
  onCreate,
}: {
  clientId: string;
  leadId: string;
  contactId: string | null;
  contactName: string | null;
  defaultListingId?: string | null;
  onOpen: (id: string) => void;
  onCreate: (prefill: CreateOfferPrefill) => void;
}) {
  const [rows, setRows] = useState<OfferListRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/offers?lead_id=${encodeURIComponent(leadId)}&tab=all`)
      .then((r) => r.json())
      .then((j: { offers?: OfferListRow[] }) => {
        if (!cancelled) {
          setRows(j.offers ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, leadId]);

  if (!loaded) return <p className="text-[13px] text-sales-text-muted">Loading offers…</p>;
  if (rows.length === 0) {
    return (
      <div>
        <p className="text-[14px] font-medium">No offers yet.</p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          When the client is ready, create an offer for one of their interested properties.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          disabled={!contactId}
          onClick={() =>
            onCreate({ listingId: defaultListingId, contactId, contactName, leadId })
          }
        >
          Create offer
        </Button>
      </div>
    );
  }

  const active = rows.filter((r) => ["draft", "submitted", "countered", "negotiating"].includes(r.status));
  const history = rows.filter((r) => !active.includes(r));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={!contactId}
          onClick={() => onCreate({ listingId: defaultListingId, contactId, contactName, leadId })}
        >
          Create offer
        </Button>
      </div>
      {active.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">Current</p>
          <ul className="mt-2 space-y-2">
            {active.map((r) => (
              <OfferMiniRow key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ) : null}
      {history.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">History</p>
          <ul className="mt-2 space-y-2">
            {history.map((r) => (
              <OfferMiniRow key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ListingOffersSection({
  clientId,
  listingId,
  listingStatus,
  onCreate,
  onOpen,
}: {
  clientId: string;
  listingId: string;
  listingStatus?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<OfferListRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/offers?listing_id=${encodeURIComponent(listingId)}&tab=all`)
      .then((r) => r.json())
      .then((j: { offers?: OfferListRow[] }) => {
        if (!cancelled) {
          setRows(j.offers ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, listingId]);

  const active = rows.filter((r) => ["draft", "submitted", "countered", "negotiating"].includes(r.status));
  const accepted = rows.filter((r) => r.status === "accepted");
  const history = rows.filter((r) => !active.includes(r) && r.status !== "accepted");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-sales-text-primary">Offers</h3>
        <Button variant="primary" size="sm" onClick={onCreate}>
          Create offer
        </Button>
      </div>
      {listingStatus === "under_offer" ? (
        <p className="text-[12px] font-medium text-sales-warning-fg">This property is under offer.</p>
      ) : null}
      {!loaded ? <p className="text-[13px] text-sales-text-muted">Loading…</p> : null}
      {loaded && rows.length === 0 ? (
        <p className="text-[13px] text-sales-text-muted">No offers on this property yet.</p>
      ) : null}
      {active.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">Active</p>
          <ul className="mt-2 space-y-2">
            {active.map((r) => (
              <OfferMiniRow key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ) : null}
      {accepted.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">Accepted</p>
          <ul className="mt-2 space-y-2">
            {accepted.map((r) => (
              <OfferMiniRow key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ) : null}
      {history.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">History</p>
          <ul className="mt-2 space-y-2">
            {history.map((r) => (
              <OfferMiniRow key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OfferMiniRow({ row, onOpen }: { row: OfferListRow; onOpen: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[10px] border border-sales-border-subtle px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">
          {row.buyerName ?? "Buyer"}
          <span className="text-sales-text-muted"> · {row.propertyLabel}</span>
        </p>
        <p className="text-[12px] text-sales-text-secondary">
          {row.currentAmountLabel} · {row.statusLabel}
          {row.status === "accepted" ? ` · ${row.complianceLabel ?? "CDD not started"}` : ""}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => onOpen(row.id)}>
        Open
      </Button>
    </li>
  );
}

