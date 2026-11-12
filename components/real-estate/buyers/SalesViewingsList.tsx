"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useMemo, useState } from "react";
import { reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { VIEWING_OUTCOMES } from "@/lib/real-estate/buyer-match";
import { Button, salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import {
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSheet,
  ReSkeletonRows,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass, asIsoTimestamp, FilterChips, WorkLine } from "@/components/real-estate/acquisition/acquisition-ui";

type Viewing = {
  id: string;
  status: string;
  scheduled_at: string;
  confirmation_status?: string | null;
  outcome?: string | null;
  access?: "full" | "listing_only" | "none";
  instructions?: string | null;
  listing_id?: string | null;
  buyer_search_id?: string | null;
  contact_id?: string | null;
  listing?: { id?: string; suburb?: string | null; address?: string | null } | null;
  contact?: { id?: string; name?: string | null; phone?: string | null } | null;
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

const shell = reSalesShell;

function sameDay(iso: string, day: Date): boolean {
  const value = new Date(iso);
  return value.getFullYear() === day.getFullYear() && value.getMonth() === day.getMonth() && value.getDate() === day.getDate();
}

export function SalesViewingsList({ clientId, buyersPath = "/sales/buyers" }: { clientId: string; buyersPath?: string }) {
  const [rows, setRows] = useState<Viewing[]>([]);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"today" | "upcoming" | "completed" | "all">("today");
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
      return row.status === "scheduled" && new Date(row.scheduled_at).getTime() >= now.getTime() - 60 * 60 * 1000;
    });
  }, [rows, filter]);

  async function confirm(row: Viewing) {
    setBusy(true);
    setFormError(null);
    const res = await fetch(`/api/clients/${clientId}/viewings?id=${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation_status: "confirmed" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setFormError(json.error ?? "Could not confirm this viewing");
      return;
    }
    setSelected(null);
    await load();
  }

  async function cancel(row: Viewing) {
    if (!cancelReason.trim()) {
      setFormError("Add a reason before cancelling this viewing.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await fetch(`/api/clients/${clientId}/viewings?id=${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", cancel_reason: cancelReason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setFormError(json.error ?? "Could not cancel this viewing");
      return;
    }
    setSelected(null);
    setCancelFor(null);
    await load();
  }

  async function saveOutcome() {
    if (!outcomeFor || !outcome) return;
    setBusy(true);
    setFormError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ action: "viewing_outcome", viewingId: outcomeFor.id, outcome }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setFormError(json.error ?? "Could not save the outcome");
      return;
    }
    setOutcomeFor(null);
    setSelected(null);
    await load();
  }

  async function saveTime(confirmOverlap: boolean) {
    if (!reschedule || !when) return;
    const nextTime = asIsoTimestamp(when);
    if (!nextTime) {
      setFormError("Pick a valid date and time.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await fetch(`/api/clients/${clientId}/viewings?id=${reschedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_at: nextTime,
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
      setFormError(json.error ?? "Could not reschedule");
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
        mobileTitle
        context="Buyer and tenant sales"
        title="Viewings"
        description="Appointments today, and outcomes still to record."
      />
      <FilterChips
        label="Viewing list"
        value={filter}
        options={[
          { id: "today", label: "Today" },
          { id: "upcoming", label: "Upcoming" },
          { id: "completed", label: "Completed" },
          { id: "all", label: "All" },
        ]}
        onChange={setFilter}
      />
      {incomplete ? <RePartialNotice>This list did not include every viewing. Filters apply only to what loaded.</RePartialNotice> : null}
      {error ? <ReErrorState title="Viewings didn't load" description={error} onRetry={() => void load()} /> : null}
      {formError && !reschedule && !cancelFor && !outcomeFor ? <p className="text-[13px] text-sales-danger-fg" role="alert">{formError}</p> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading viewings" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReEmptyState
          framed
          icon={<CalendarClock />}
          title={
            filter === "today"
              ? "No viewings today"
              : filter === "completed"
                ? "No completed viewings"
                : filter === "all"
                  ? "No viewings yet"
                  : "No upcoming viewings"
          }
          description="Share a viewing form from the property. When the buyer signs it, the appointment appears here."
          action={<Link href={buyersPath.replace("/buyers", "/listings")} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open a property</Link>}
        />
      ) : null}
      {!loading && visible.length > 0 ? (
        <ReSection id="viewings" title="Viewings" count={visible.length} flush>
          <ul>
            {visible.map((row) => {
              const whenDate = row.scheduled_at ? new Date(row.scheduled_at) : null;
              const place = row.listing?.suburb || row.listing?.address || "Property";
              const who = row.contact?.name || (row.access === "listing_only" ? "Customer hidden" : "Customer");
              const when = whenDate
                ? whenDate.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                : "Time open";
              const detail = row.outcome
                ? (OUTCOME_LABEL[row.outcome] ?? row.outcome.replaceAll("_", " "))
                : row.status === "cancelled"
                  ? "Cancelled"
                  : row.status === "completed" || row.status === "no_show"
                    ? "Outcome recorded"
                    : when;
              return (
                <WorkLine
                  key={row.id}
                  name={who}
                  meta={place}
                  detail={detail}
                  action="Open"
                  onClick={() => setSelected(row)}
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}

      {selected ? (
        <ReSheet title={selected.listing?.suburb || selected.listing?.address || "Viewing"} description={selected.scheduled_at ? new Date(selected.scheduled_at).toLocaleString() : undefined} onClose={() => setSelected(null)}>
          <dl className="mb-4 space-y-2 text-[14px]">
            <div><dt className="text-[12px] text-sales-text-muted">Buyer</dt><dd>{selected.contact?.name || "Not available"}</dd></div>
            <div><dt className="text-[12px] text-sales-text-muted">Property</dt><dd>{selected.listing?.address || selected.listing?.suburb || "Property"}</dd></div>
            {selected.outcome ? <div><dt className="text-[12px] text-sales-text-muted">Outcome</dt><dd>{OUTCOME_LABEL[selected.outcome] ?? selected.outcome}</dd></div> : null}
            {selected.access === "full" && selected.contact?.phone ? <div><dt className="text-[12px] text-sales-text-muted">Phone</dt><dd>{selected.contact.phone}</dd></div> : null}
          </dl>
          <div className="flex flex-wrap gap-2">
            {selected.access !== "listing_only" && selected.status === "scheduled" ? (
              <>
                <button type="button" className="inline-flex h-11 items-center rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface" onClick={() => void confirm(selected)}>Confirm</button>
                <button type="button" className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold" onClick={() => { setSelected(null); setWhen(""); setOverlap(null); setReschedule(selected); }}>Reschedule</button>
                <button type="button" className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold" onClick={() => { setSelected(null); setCancelReason(""); setCancelFor(selected); }}>Cancel</button>
              </>
            ) : null}
            <button type="button" className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold" onClick={() => { setSelected(null); setOutcome(""); setOutcomeFor(selected); }}>Record outcome</button>
            {selected.buyer_search_id ? <Link href={`${buyersPath}/${selected.buyer_search_id}`} className="inline-flex min-h-11 items-center rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface">Open buyer</Link> : null}
            {selected.listing_id || selected.listing?.id ? <Link href={`${buyersPath.replace(/\/buyers$/, "/listings")}/${selected.listing_id || selected.listing?.id}`} className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold">Open property</Link> : null}
            {selected.outcome === "wants_offer" || selected.outcome === "interested" ? (
              <Link href={`${buyersPath.replace(/\/buyers$/, "/offers")}?${new URLSearchParams({ ...(selected.listing_id || selected.listing?.id ? { listingId: selected.listing_id || selected.listing?.id || "" } : {}), ...(selected.contact_id || selected.contact?.id ? { contactId: selected.contact_id || selected.contact?.id || "" } : {}), ...(selected.buyer_search_id ? { buyerSearchId: selected.buyer_search_id } : {}) }).toString()}`} className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold">Generate offer letter</Link>
            ) : null}
          </div>
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
          {formError ? <p className="mt-3 text-[13px] text-sales-danger-fg" role="alert">{formError}</p> : null}
          <Button type="button" variant="primary" size="md" className="mt-3" loading={busy} disabled={busy || !when} onClick={() => void saveTime(false)}>{busy ? "Saving…" : "Save new time"}</Button>
        </ReSheet>
      ) : null}

      {cancelFor ? (
        <ReSheet title="Cancel viewing" description="This does not book a replacement." onClose={() => setCancelFor(null)}>
          <label className={acqLabelClass} htmlFor="cancel-reason">Reason</label>
          <input id="cancel-reason" className={acqFieldClass} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          {formError ? <p className="mt-3 text-[13px] text-sales-danger-fg" role="alert">{formError}</p> : null}
          <Button type="button" variant="secondary" size="md" className="mt-3" loading={busy} disabled={busy || !cancelReason.trim()} onClick={() => void cancel(cancelFor)}>{busy ? "Saving…" : "Cancel viewing"}</Button>
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
          {formError ? <p className="mt-3 text-[13px] text-sales-danger-fg" role="alert">{formError}</p> : null}
          <Button type="button" variant="primary" size="md" className="mt-3" loading={busy} disabled={busy || !outcome} onClick={() => void saveOutcome()}>{busy ? "Saving…" : "Save outcome"}</Button>
        </ReSheet>
      ) : null}
    </div>
  );
}
