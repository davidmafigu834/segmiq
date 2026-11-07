"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Phone, ScrollText, UserRound } from "lucide-react";
import { MandateActions, type MandateRow } from "./MandateActions";
import { ContextCompliancePanel } from "@/components/real-estate/compliance/ContextCompliancePanel";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
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
import { SellerIntakePanel } from "@/components/real-estate/seller-intake/SellerIntakePanel";

const shellClass = reSalesShell;

type Owner = {
  contactId: string;
  name: string | null;
  kind?: "individual" | "company" | "unknown";
  representatives?: string[];
  properties: number;
  active: number;
  opportunityIds?: string[];
  limit?: string | null;
};
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

export function OwnerList({ clientId, basePath, framed = false }: { clientId: string; basePath: string; framed?: boolean }) {
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
    const owner = owners.find((item) => item.contactId === selected);
    if (owner?.opportunityIds?.length) return opportunities.filter((row) => owner.opportunityIds?.includes(row.id));
    if (selected.startsWith("unlinked:")) return opportunities.filter((row) => `unlinked:${row.id}` === selected);
    return opportunities.filter((row) => row.contact_id === selected);
  }, [opportunities, owners, selected]);
  const phone = linked.find((row) => row.owner_phone)?.owner_phone ?? null;
  const listingsPath = basePath.replace(/\/owners$/, "/listings");
  const mandatesPath = basePath.replace(/\/owners$/, "/mandates");

  return (
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        title="Sellers"
        description="Each completed mandate opens a seller here, with the property they are listing underneath."
      />
      <SellerIntakePanel clientId={clientId} mode="queue" />
      <label>
        <span className="sr-only">Search owners</span>
        <input className={acqFieldClass} placeholder="Search by name" value={q} onChange={(event) => setQ(event.target.value)} />
      </label>
      {error ? <ReErrorState title="Owners didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={5} label="Loading owners" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReEmptyState
          framed
          title="No sellers yet"
          description="A seller profile is created when a mandate form is completed."
          action={<Link href={mandatesPath} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>Send a mandate form</Link>}
        />
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ReSection id="owners" title="Sellers" count={visible.length} flush>
          <ul className="divide-y divide-sales-border-subtle">
            {visible.map((owner) => {
              const name = owner.name || "Unnamed owner";
              const owned = (row: { id: string; contact_id: string | null }) => owner.opportunityIds?.length
                ? owner.opportunityIds.includes(row.id)
                : (owner.contactId.startsWith("unlinked:") ? `unlinked:${row.id}` === owner.contactId : row.contact_id === owner.contactId);
              const ownerPhone = opportunities.find((row) => owned(row) && row.owner_phone)?.owner_phone;
              const places = opportunities
                .filter((row) => owned(row))
                .map((row) => row.suburb || row.city)
                .filter((value): value is string => Boolean(value))
                .slice(0, 3);
              return (
                <ReWorkItem
                  key={owner.contactId}
                  icon={<UserRound />}
                  title={name}
                  reason={[
                    owner.kind === "company" ? "Company" : null,
                    owner.representatives?.length ? `Representatives: ${owner.representatives.join(", ")}` : null,
                    places.length ? places.join(" · ") : "Location not recorded",
                    owner.limit,
                  ].filter(Boolean).join(" · ")}
                  meta={<span>{owner.properties} {owner.properties === 1 ? "property" : "properties"} · {owner.active} active</span>}
                  action={<ReRowAction label="View" srContext={name} onClick={() => setSelected(owner.contactId)} />}
                  menu={
                    <ReActionMenu
                      label={`Actions for ${name}`}
                      sheetTitle={name}
                      actions={[
                        { id: "view", label: "View seller", onSelect: () => setSelected(owner.contactId) },
                        { id: "form", label: "Send mandate form", onSelect: () => router.push(mandatesPath) },
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
          ) : <p className="mb-3 text-[13px] text-sales-text-muted">No phone on this seller yet.</p>}
          {selectedOwner.contactId.startsWith("unlinked:") ? null : (
            <ContextCompliancePanel clientId={clientId} context="seller" title="Seller verification" contactId={selectedOwner.contactId} />
          )}
          <ul className="mt-4 divide-y divide-sales-border">
            {linked.map((row) => (
              <li key={row.id} className="py-2.5">
                <p className="text-[14px] font-semibold">{[row.suburb, row.city].filter(Boolean).join(", ") || "Location pending"}</p>
                <p className="mt-0.5 text-[12px] text-sales-text-muted">
                  {row.property_intent === "sale" ? "For sale" : row.property_intent === "rent" ? "To rent" : "Intent not set"} · {row.status.replaceAll("_", " ")}
                </p>
                <Link href={listingsPath} className="re-focus mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold underline-offset-2 hover:underline">
                  Listing details
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

export function InspectionList({ clientId, opportunityBase, framed = false }: { clientId: string; opportunityBase: string; framed?: boolean }) {
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
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        title="Inspections"
        description="The listing from the mandate stays incomplete until this visit, the photos, and the remaining details are added."
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Inspection filter">
        {INSPECTION_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`re-focus inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${filter === item.id ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border text-sales-text-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {incomplete ? <RePartialNotice>Some inspections could not be loaded. This list may be short.</RePartialNotice> : null}
      {error ? <ReErrorState title="Inspections didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading inspections" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReEmptyState
          framed
          title={filter === "all" ? "No inspections yet" : "No inspections in this view"}
          description={filter === "all" ? "Open a listing that came from a mandate and record the inspection there." : "Nothing in this filter."}
          action={<Link href={opportunityBase.replace("/acquisitions", "/listings")} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open listings</Link>}
        />
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
                        <ReRowAction label={unfinished ? "Complete listing" : "Open listing"} srContext={label} href={`${opportunityBase}/${String(row.opportunity_id)}#acq-inspection`} />
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
                  action={<ReRowAction label={unfinished ? "Complete listing" : "Open listing"} srContext={label} href={`${opportunityBase}/${String(row.opportunity_id)}#acq-inspection`} />}
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

export function MandateList({ clientId, opportunityBase, framed = false }: { clientId: string; opportunityBase: string; framed?: boolean }) {
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
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        title="Mandates"
        description="Send the seller form. When it is approved, SegmiQ opens the seller profile and a draft listing."
      />
      <SellerIntakePanel clientId={clientId} mode="send" />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Mandate filter">
        {MANDATE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`re-focus inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${filter === item.id ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border text-sales-text-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {incomplete ? <RePartialNotice>Some mandates could not be loaded. This list is not complete, so a filter is not the full agency picture.</RePartialNotice> : null}
      {error ? <ReErrorState title="Mandates didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading mandates" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReEmptyState
          framed
          title={filter === "attention" ? "No mandates awaiting review" : "No mandates in this view"}
          description={filter === "attention" ? "Send the form above. Submitted mandates show here for review." : "Nothing matches this status in the mandates that loaded."}
        />
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
                        { id: "view", label: "Review mandate", onSelect: () => setOpenId(row.id) },
                        { id: "seller", label: "Open sellers", onSelect: () => { window.location.href = opportunityBase.replace("/acquisitions", "/owners"); } },
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
          headerAside={<Link href={opportunityBase.replace("/acquisitions", "/owners")} className="text-[13px] font-semibold underline-offset-2 hover:underline">Sellers</Link>}
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
