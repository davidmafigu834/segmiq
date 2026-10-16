"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Phone, ScrollText, UserRound } from "lucide-react";
import { MandateActions, type MandateRow } from "./MandateActions";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  RePartialNotice,
  ReRowAction,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatusBadge,
  ReWorkItem,
} from "@/components/real-estate/ui";
import {
  acqFieldClass,
  formatWhen,
  inspectionStatusLabel,
  inspectionTone,
  mandateStatusLabel,
  mandateTone,
  mandateTypeLabel,
} from "./acquisition-ui";

const shellClass =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-[var(--re-section-gap,16px)] overflow-y-auto overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:pb-6";

type Owner = { contactId: string; name: string | null; properties: number; active: number };
type OpportunityRow = {
  id: string;
  contact_id: string | null;
  owner_name: string | null;
  owner_phone?: string | null;
  suburb: string | null;
  city: string | null;
  property_intent: string;
  stage: string;
  status: string;
  updated_at?: string;
};

export function OwnerList({ clientId, basePath }: { clientId: string; basePath: string }) {
  const router = useRouter();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/owners`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not load owners");
      return;
    }
    setError(null);
    setOwners(json.owners ?? []);
    setOpportunities(json.opportunities ?? []);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("contactId");
    if (id) setSelected(id);
  }, []);

  const visible = owners.filter((owner) => {
    const name = (owner.name || "Unnamed owner").toLowerCase();
    return !q.trim() || name.includes(q.trim().toLowerCase());
  });
  const selectedOwner = owners.find((owner) => owner.contactId === selected) ?? null;
  const linked = useMemo(() => {
    if (!selected) return [];
    if (selected.startsWith("unlinked:")) return opportunities.filter((row) => `unlinked:${row.id}` === selected);
    return opportunities.filter((row) => row.contact_id === selected);
  }, [opportunities, selected]);
  const phone = linked.find((row) => row.owner_phone)?.owner_phone ?? null;
  const acquisitionsPath = basePath.replace(/\/owners$/, "/acquisitions");

  return (
    <div className={shellClass}>
      <RePageHeader
        title="Property owners"
        description="Manage owner relationships and the properties they bring to your agency."
      />
      <label>
        <span className="sr-only">Search owners</span>
        <input className={acqFieldClass} placeholder="Search by name" value={q} onChange={(event) => setQ(event.target.value)} />
      </label>
      {error ? <ReErrorState title="Owners didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={5} label="Loading owners" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReSection id="owners-empty" title="No property owners yet">
          <ReEmptyState
            title="No property owners yet"
            description="Owner relationships appear when you record a property opportunity against a contact."
            action={<Link href={`${acquisitionsPath}?new=1`} className="text-[13px] font-semibold underline-offset-2 hover:underline">New opportunity</Link>}
          />
        </ReSection>
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ReSection id="owners" title="Owners" count={visible.length} flush>
          <ul className="divide-y divide-sales-border-subtle">
            {visible.map((owner) => {
              const name = owner.name || "Unnamed owner";
              const ownerPhone = opportunities.find((row) => (owner.contactId.startsWith("unlinked:") ? `unlinked:${row.id}` === owner.contactId : row.contact_id === owner.contactId) && row.owner_phone)?.owner_phone;
              const places = opportunities
                .filter((row) => (owner.contactId.startsWith("unlinked:") ? `unlinked:${row.id}` === owner.contactId : row.contact_id === owner.contactId))
                .map((row) => row.suburb || row.city)
                .filter((value): value is string => Boolean(value))
                .slice(0, 3);
              return (
                <ReWorkItem
                  key={owner.contactId}
                  icon={<UserRound />}
                  title={name}
                  reason={places.length ? places.join(" · ") : "Location not recorded"}
                  meta={<span>{owner.properties} {owner.properties === 1 ? "property" : "properties"} · {owner.active} active</span>}
                  action={<ReRowAction label="View" srContext={name} onClick={() => setSelected(owner.contactId)} />}
                  menu={
                    <ReActionMenu
                      label={`Actions for ${name}`}
                      sheetTitle={name}
                      actions={[
                        { id: "view", label: "View owner", onSelect: () => setSelected(owner.contactId) },
                        { id: "new", label: "New opportunity", description: "Opens a blank opportunity. It does not attach this owner automatically.", onSelect: () => router.push(`${acquisitionsPath}?new=1`) },
                        ...(ownerPhone
                          ? [
                              { id: "call", label: "Call", onSelect: () => { window.location.href = `tel:${ownerPhone}`; } },
                              { id: "wa", label: "WhatsApp", onSelect: () => { window.location.href = `https://wa.me/${ownerPhone.replace(/\D/g, "")}`; } },
                            ]
                          : []),
                      ]}
                    />
                  }
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}

      {selectedOwner ? (
        <ReSheet title={selectedOwner.name || "Unnamed owner"} description={`${selectedOwner.properties} properties · ${selectedOwner.active} active`} onClose={() => setSelected(null)}>
          {phone ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <a href={`tel:${phone}`} className="re-focus inline-flex min-h-11 items-center gap-1.5 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold">
                <Phone size={14} aria-hidden /> Call
              </a>
              <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold">
                WhatsApp
              </a>
            </div>
          ) : <p className="mb-3 text-[13px] text-sales-text-muted">No phone on these opportunities.</p>}
          <ul className="space-y-2">
            {linked.map((row) => (
              <li key={row.id} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                <p className="text-[14px] font-semibold">{[row.suburb, row.city].filter(Boolean).join(", ") || "Location pending"}</p>
                <p className="mt-0.5 text-[12px] text-sales-text-muted">
                  {row.property_intent === "sale" ? "For sale" : row.property_intent === "rent" ? "To rent" : "Intent not set"} · {row.status.replaceAll("_", " ")}
                </p>
                <Link href={`${acquisitionsPath}/${row.id}`} className="re-focus mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold underline-offset-2 hover:underline">
                  Open opportunity
                </Link>
              </li>
            ))}
          </ul>
        </ReSheet>
      ) : null}
    </div>
  );
}

const INSPECTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "attention", label: "Needs attention" },
] as const;

export function InspectionList({ clientId, opportunityBase }: { clientId: string; opportunityBase: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState(false);
  const [filter, setFilter] = useState<(typeof INSPECTION_FILTERS)[number]["id"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/inspections`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not load inspections");
      return;
    }
    setError(null);
    setRows(json.inspections ?? []);
    setIncomplete(Boolean(json.incomplete));
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((row) => {
    const status = String(row.status ?? "");
    if (filter === "all") return true;
    if (filter === "completed") return status === "completed";
    if (filter === "cancelled") return status === "cancelled";
    if (filter === "upcoming") return ["scheduled", "confirmed", "rescheduled"].includes(status);
    const when = row.scheduled_at ? new Date(String(row.scheduled_at)).getTime() : NaN;
    return status === "incomplete" || (["scheduled", "confirmed", "rescheduled"].includes(status) && !Number.isNaN(when) && when < Date.now());
  });

  return (
    <div className={shellClass}>
      <RePageHeader
        title="Property inspections"
        description="Schedule and record property assessments. These are not buyer viewings."
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Inspection filter">
        {INSPECTION_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`re-focus inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[13px] font-semibold ${filter === item.id ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border text-sales-text-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {incomplete ? <RePartialNotice>Some inspections could not be loaded. This list may be short.</RePartialNotice> : null}
      {error ? <ReErrorState title="Inspections didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading inspections" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReSection id="inspections-empty" title="No inspections found">
          <ReEmptyState
            title={filter === "all" ? "No inspections found" : "Nothing in this view"}
            description="Inspections are recorded from a property opportunity, not from this list."
            action={<Link href={opportunityBase} className="text-[13px] font-semibold underline-offset-2 hover:underline">Open opportunities</Link>}
          />
        </ReSection>
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ReSection id="inspections" title="Inspections" count={visible.length} flush>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left text-[13px]">
              <caption className="sr-only">Property inspections</caption>
              <thead>
                <tr className="border-y border-sales-border-subtle bg-sales-surface-subtle text-[12px] text-sales-text-secondary">
                  <th className="px-[var(--re-card-pad,16px)] py-2 font-medium">Property</th>
                  <th className="px-3 py-2 font-medium">Scheduled</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="w-[140px] px-3 py-2 font-medium"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {visible.map((row) => {
                  const label = String(row.suburb || row.address || "Inspection");
                  const unfinished = ["draft", "incomplete", "in_progress"].includes(String(row.status));
                  return (
                    <tr key={String(row.id)}>
                      <td className="truncate px-[var(--re-card-pad,16px)] py-3 font-semibold">{label}</td>
                      <td className="px-3 py-3 text-sales-text-secondary">{row.scheduled_at ? formatWhen(String(row.scheduled_at)) : "Not scheduled"}</td>
                      <td className="px-3 py-3"><ReStatusBadge label={inspectionStatusLabel(String(row.status))} tone={inspectionTone(String(row.status))} /></td>
                      <td className="px-3 py-3">
                        <ReRowAction label={unfinished ? "Continue" : "Open"} srContext={label} href={`${opportunityBase}/${String(row.opportunity_id)}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {visible.map((row) => {
              const label = String(row.suburb || row.address || "Inspection");
              const unfinished = ["draft", "incomplete", "in_progress"].includes(String(row.status));
              return (
                <ReWorkItem
                  key={String(row.id)}
                  icon={<ClipboardCheck />}
                  title={label}
                  reason={row.scheduled_at ? formatWhen(String(row.scheduled_at)) ?? undefined : "Not scheduled"}
                  status={<ReStatusBadge label={inspectionStatusLabel(String(row.status))} tone={inspectionTone(String(row.status))} />}
                  action={<ReRowAction label={unfinished ? "Continue" : "Open"} srContext={label} href={`${opportunityBase}/${String(row.opportunity_id)}`} />}
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}
    </div>
  );
}

const MANDATE_FILTERS = [
  { id: "attention", label: "Pending review" },
  { id: "approved", label: "Active" },
  { id: "expiring", label: "Expiring" },
  { id: "expired", label: "Expired" },
  { id: "revoked", label: "Rejected or revoked" },
  { id: "legacy", label: "Legacy unverified" },
  { id: "all", label: "All" },
] as const;

export function MandateList({ clientId, opportunityBase }: { clientId: string; opportunityBase: string }) {
  const [rows, setRows] = useState<MandateRow[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof MANDATE_FILTERS)[number]["id"]>("attention");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/mandates`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not load mandates.");
      return;
    }
    setError(null);
    setRows(json.mandates ?? []);
    setCanReview(Boolean(json.canReview));
    setIncomplete(Boolean(json.incomplete));
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((row) => {
    const status = String(row.displayStatus ?? row.status);
    if (filter === "all") return true;
    if (filter === "approved") return status === "approved" || status === "expiring_soon";
    if (filter === "expiring") return status === "expiring_soon";
    if (filter === "expired") return status === "expired";
    if (filter === "revoked") return status === "rejected" || status === "revoked";
    if (filter === "legacy") return status === "legacy_unverified";
    return ["submitted", "awaiting_evidence", "expiring_soon", "expired"].includes(status) && !row.superseded_by_id;
  });
  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <div className={shellClass}>
      <RePageHeader
        title="Property mandates"
        description={canReview ? "Review marketing authority before a property can be prepared as a listing." : "Mandates you can access. A manager approves, rejects, renews and revokes them."}
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Mandate filter">
        {MANDATE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`re-focus inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[13px] font-semibold ${filter === item.id ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border text-sales-text-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {incomplete ? <RePartialNotice>Some mandates could not be loaded. This list is not complete, so a filter is not the full agency picture.</RePartialNotice> : null}
      {error ? <ReErrorState title="Mandates didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading mandates" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReSection id="mandates-empty" title="No mandates found">
          <ReEmptyState
            title="No mandates found"
            description={filter === "all" ? "Mandates are recorded from a property opportunity." : "Nothing in this view. The list is filtered from the mandates that loaded."}
          />
        </ReSection>
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ReSection id="mandates" title="Mandates" count={visible.length} flush>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left text-[13px]">
              <caption className="sr-only">Property mandates</caption>
              <thead>
                <tr className="border-y border-sales-border-subtle bg-sales-surface-subtle text-[12px] text-sales-text-secondary">
                  <th className="w-[28%] px-[var(--re-card-pad,16px)] py-2 font-medium">Property</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Expiry</th>
                  <th className="w-[120px] px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {visible.map((row) => {
                  const status = String(row.displayStatus ?? row.status);
                  const label = String(row.propertyLabel ?? "Property");
                  return (
                    <tr key={row.id} className="cursor-pointer hover:bg-sales-surface-hover" onClick={() => setOpenId(row.id)}>
                      <td className="truncate px-[var(--re-card-pad,16px)] py-3 font-semibold">{label}</td>
                      <td className="px-3 py-3 text-sales-text-secondary">{mandateTypeLabel(row.mandate_type as string)}</td>
                      <td className="px-3 py-3"><ReStatusBadge label={mandateStatusLabel(status)} tone={mandateTone(status)} /></td>
                      <td className="px-3 py-3 text-sales-text-secondary">{row.expiry_date ? String(row.expiry_date) : "No expiry"}</td>
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <ReRowAction label="Review" srContext={label} onClick={() => setOpenId(row.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {visible.map((row) => {
              const status = String(row.displayStatus ?? row.status);
              const label = String(row.propertyLabel ?? "Property");
              return (
                <ReWorkItem
                  key={row.id}
                  icon={<ScrollText />}
                  title={label}
                  reason={`${mandateTypeLabel(row.mandate_type as string)} · ${row.expiry_date ? `expires ${String(row.expiry_date)}` : "no expiry"}`}
                  status={<ReStatusBadge label={mandateStatusLabel(status)} tone={mandateTone(status)} />}
                  action={<ReRowAction label="Review" srContext={label} onClick={() => setOpenId(row.id)} />}
                  menu={
                    <ReActionMenu
                      label={`Actions for ${label}`}
                      sheetTitle={label}
                      actions={[
                        { id: "view", label: "View mandate", onSelect: () => setOpenId(row.id) },
                        ...(row.opportunity_id
                          ? [{ id: "opp", label: "Open opportunity", onSelect: () => { window.location.href = `${opportunityBase}/${String(row.opportunity_id)}`; } }]
                          : []),
                      ]}
                    />
                  }
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}

      {open ? (
        <ReSheet
          title={String(open.propertyLabel ?? "Mandate")}
          description={mandateStatusLabel(String(open.displayStatus ?? open.status))}
          onClose={() => setOpenId(null)}
          headerAside={open.opportunity_id ? <Link href={`${opportunityBase}/${String(open.opportunity_id)}`} className="text-[13px] font-semibold underline-offset-2 hover:underline">Opportunity</Link> : undefined}
        >
          <dl className="mb-4 space-y-2 text-[13px]">
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">Type</dt><dd>{mandateTypeLabel(open.mandate_type as string)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">Start</dt><dd>{open.start_date ? String(open.start_date) : "Not set"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">Expiry</dt><dd>{open.expiry_date ? String(open.expiry_date) : "No expiry"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">Evidence</dt><dd className="text-right">{String(open.evidence_status ?? "not provided").replaceAll("_", " ")}</dd></div>
          </dl>
          <p className="mb-3 text-[12px] leading-snug text-sales-text-muted">Evidence on file is not described here as legally valid. Approval is a separate decision.</p>
          <MandateActions clientId={clientId} mandate={open} canReview={canReview} onChanged={() => void load()} />
        </ReSheet>
      ) : null}
    </div>
  );
}
