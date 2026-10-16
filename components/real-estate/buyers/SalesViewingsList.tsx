"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VIEWING_OUTCOMES } from "@/lib/real-estate/buyer-match";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";

type Viewing = {
  id: string;
  status: string;
  scheduled_at: string;
  confirmation_status?: string | null;
  outcome?: string | null;
  access?: "full" | "listing_only" | "none";
  instructions?: string | null;
  listing?: { suburb?: string | null; address?: string | null } | null;
  contact?: { name?: string | null; phone?: string | null } | null;
};

const OUTCOME_LABEL: Record<string, string> = {
  interested: "Interested",
  considering: "Considering",
  second_viewing: "Second viewing",
  wants_offer: "Wants to make an offer",
  too_expensive: "Too expensive",
  location_unsuitable: "Location unsuitable",
  condition: "Property condition",
  not_interested: "Not interested",
  no_show: "Did not attend",
};

const shell =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:px-6 md:pb-6";

function sameDay(iso: string, day: Date): boolean {
  const value = new Date(iso);
  return value.getFullYear() === day.getFullYear() && value.getMonth() === day.getMonth() && value.getDate() === day.getDate();
}

export function SalesViewingsList({ clientId, buyersPath = "/sales/buyers" }: { clientId: string; buyersPath?: string }) {
  const [rows, setRows] = useState<Viewing[]>([]);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "today" | "completed" | "cancelled" | "all">("upcoming");
  const [selected, setSelected] = useState<Viewing | null>(null);
  const [reschedule, setReschedule] = useState<Viewing | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<Viewing | null>(null);
  const [cancelFor, setCancelFor] = useState<Viewing | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [outcome, setOutcome] = useState("");
  const [when, setWhen] = useState("");
  const [overlap, setOverlap] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/viewings`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not load viewings");
      setLoading(false);
      return;
    }
    setError(null);
    setRows(json.viewings ?? []);
    setIncomplete(Boolean(json.incomplete));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const visible = useMemo(() => {
    const now = new Date();
    return rows.filter((row) => {
      if (filter === "all") return true;
      if (filter === "today") return sameDay(row.scheduled_at, now);
      if (filter === "completed") return row.status === "completed" || row.status === "no_show";
      if (filter === "cancelled") return row.status === "cancelled";
      return row.status === "scheduled" && new Date(row.scheduled_at).getTime() >= now.getTime() - 60 * 60 * 1000;
    });
  }, [rows, filter]);

  async function confirm(row: Viewing) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/viewings?id=${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation_status: "confirmed" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not confirm this viewing");
      return;
    }
    setSelected(null);
    await load();
  }

  async function cancel(row: Viewing) {
    if (!cancelReason.trim()) {
      setError("Add a reason before cancelling this viewing.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/viewings?id=${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", cancel_reason: cancelReason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not cancel this viewing");
      return;
    }
    setSelected(null);
    setCancelFor(null);
    await load();
  }

  async function saveOutcome() {
    if (!outcomeFor || !outcome) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ action: "viewing_outcome", viewingId: outcomeFor.id, outcome }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save the outcome");
      return;
    }
    setOutcomeFor(null);
    setSelected(null);
    await load();
  }

  async function saveTime(confirmOverlap: boolean) {
    if (!reschedule || !when) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/viewings?id=${reschedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_at: new Date(when).toISOString(),
        confirm_overlap: confirmOverlap,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (res.status === 409 && json.warning && !confirmOverlap) {
        setOverlap(String(json.warning));
        return;
      }
      setError(json.error ?? "Could not reschedule");
      return;
    }
    setOverlap(null);
    setReschedule(null);
    setSelected(null);
    await load();
  }

  return (
    <div className={shell}>
      <RePageHeader
        title="Property viewings"
        description="Manage appointments, property visits and customer feedback."
        actions={<Link href={buyersPath} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Schedule from a search</Link>}
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Viewing list">
        {([
          ["upcoming", "Upcoming"],
          ["today", "Today"],
          ["completed", "Completed"],
          ["cancelled", "Cancelled"],
          ["all", "All"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn("re-focus inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[13px] font-semibold", filter === id ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border")}
          >
            {label}
          </button>
        ))}
      </div>
      {incomplete ? <RePartialNotice>This list did not include every viewing. Filters apply only to what loaded.</RePartialNotice> : null}
      {error ? <ReErrorState title="Viewings" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading viewings" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReSection id="viewings-empty" title="No viewings scheduled">
          <ReEmptyState title="No viewings scheduled" description="New appointments are booked from a buyer or tenant search, so the customer and property stay linked." action={<Link href={buyersPath} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Open buyers and tenants</Link>} />
        </ReSection>
      ) : null}
      {!loading && visible.length > 0 ? (
        <ul className="space-y-2">
          {visible.map((row) => {
            const whenDate = row.scheduled_at ? new Date(row.scheduled_at) : null;
            const time = whenDate ? whenDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Time open";
            const place = row.listing?.suburb || row.listing?.address || "Property";
            const full = row.access !== "listing_only";
            return (
              <li key={row.id} className="rounded-[12px] border border-sales-border-subtle bg-sales-surface px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-[22px] font-semibold leading-none tabular-nums">{time}</p>
                    <p className="mt-1 text-[14px] font-semibold leading-snug [overflow-wrap:anywhere]">{place}</p>
                  </div>
                  <ReActionMenu
                    label={`Actions for ${place}`}
                    sheetTitle={place}
                    actions={[
                      { id: "open", label: "View details", onSelect: () => setSelected(row) },
                      ...(full && row.status === "scheduled"
                        ? [
                            { id: "confirm", label: "Confirm", onSelect: () => void confirm(row) },
                            { id: "move", label: "Reschedule", onSelect: () => { setWhen(""); setOverlap(null); setReschedule(row); } },
                            { id: "cancel", label: "Cancel", destructive: true, onSelect: () => { setCancelReason(""); setCancelFor(row); } },
                          ]
                        : []),
                      { id: "outcome", label: "Record outcome", onSelect: () => { setOutcome(""); setOutcomeFor(row); } },
                    ]}
                  />
                </div>
                <p className="mt-2 text-[13px] text-sales-text-secondary [overflow-wrap:anywhere]">
                  {whenDate ? whenDate.toLocaleDateString() : ""}
                  {" · "}
                  {row.contact?.name || (row.access === "listing_only" ? "Customer hidden" : "Customer")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ReStatusBadge label={row.status.replaceAll("_", " ")} />
                  {row.confirmation_status ? <ReStatusBadge label={row.confirmation_status.replaceAll("_", " ")} tone="info" /> : null}
                  {row.outcome ? <ReStatusBadge label={OUTCOME_LABEL[row.outcome] ?? row.outcome.replaceAll("_", " ")} /> : null}
                </div>
                <button type="button" className="re-focus mt-2 min-h-11 text-[13px] font-semibold" onClick={() => setSelected(row)}>View details</button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selected ? (
        <ReSheet title={selected.listing?.suburb || selected.listing?.address || "Viewing"} description={selected.scheduled_at ? new Date(selected.scheduled_at).toLocaleString() : undefined} onClose={() => setSelected(null)}>
          <dl className="space-y-2 text-[14px]">
            <div><dt className="text-[12px] text-sales-text-muted">Status</dt><dd>{selected.status.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-[12px] text-sales-text-muted">Confirmation</dt><dd>{selected.confirmation_status?.replaceAll("_", " ") || "Not recorded"}</dd></div>
            <div><dt className="text-[12px] text-sales-text-muted">Customer</dt><dd>{selected.contact?.name || "Not available"}</dd></div>
            {selected.access === "full" && selected.contact?.phone ? <div><dt className="text-[12px] text-sales-text-muted">Phone</dt><dd>{selected.contact.phone}</dd></div> : null}
            {selected.access === "listing_only" ? <p className="text-[13px] text-sales-text-secondary">You can see this appointment because of the listing. The customer contact details stay with the agent who owns the search.</p> : null}
            {selected.instructions ? <div><dt className="text-[12px] text-sales-text-muted">Instructions</dt><dd className="[overflow-wrap:anywhere]">{selected.instructions}</dd></div> : null}
            {selected.outcome ? <div><dt className="text-[12px] text-sales-text-muted">Outcome</dt><dd>{OUTCOME_LABEL[selected.outcome] ?? selected.outcome}</dd></div> : null}
          </dl>
        </ReSheet>
      ) : null}

      {reschedule ? (
        <ReSheet title="Reschedule viewing" description={reschedule.scheduled_at ? `Current time ${new Date(reschedule.scheduled_at).toLocaleString()}` : undefined} onClose={() => setReschedule(null)}>
          <label className={acqLabelClass} htmlFor="new-time">New date and time</label>
          <input id="new-time" type="datetime-local" className={acqFieldClass} value={when} onChange={(event) => setWhen(event.target.value)} />
          {overlap ? (
            <div className="mt-3 rounded-[10px] border border-sales-warning/40 bg-sales-warning-soft p-3" role="alert">
              <p className="text-[13px]">{overlap}</p>
              <button type="button" className="re-focus mt-2 min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void saveTime(true)}>Continue anyway</button>
            </div>
          ) : null}
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 min-h-11")} disabled={busy || !when} onClick={() => void saveTime(false)}>{busy ? "Saving…" : "Save new time"}</button>
        </ReSheet>
      ) : null}

      {cancelFor ? (
        <ReSheet title="Cancel viewing" description="This does not book a replacement." onClose={() => setCancelFor(null)}>
          <label className={acqLabelClass} htmlFor="cancel-reason">Reason</label>
          <input id="cancel-reason" className={acqFieldClass} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "mt-3 min-h-11")} disabled={busy || !cancelReason.trim()} onClick={() => void cancel(cancelFor)}>{busy ? "Saving…" : "Cancel viewing"}</button>
        </ReSheet>
      ) : null}

      {outcomeFor ? (
        <ReSheet title="Record viewing outcome" onClose={() => setOutcomeFor(null)}>
          <ul>
            {VIEWING_OUTCOMES.map((value) => (
              <li key={value}>
                <label className="flex min-h-12 items-center gap-3 text-[14px]">
                  <input type="radio" name="list-outcome" checked={outcome === value} onChange={() => setOutcome(value)} />
                  {OUTCOME_LABEL[value] ?? value}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 min-h-11")} disabled={busy || !outcome} onClick={() => void saveOutcome()}>{busy ? "Saving…" : "Save outcome"}</button>
        </ReSheet>
      ) : null}
    </div>
  );
}
