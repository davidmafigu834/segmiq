"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mandateFormVisible, mandateKindLabel, type MandateFormFilter } from "@/lib/real-estate/mandate-form";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import {
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSheet,
  ReSkeletonRows,
} from "@/components/real-estate/ui";
import {
  acqFieldClass,
  FilterChips,
  formatWhen,
  WorkLine,
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
    const params = new URL(window.location.href).searchParams;
    const search = params.get("q");
    if (search) setQ(search);
    const id = params.get("contactId");
    if (!id || id.startsWith("company:")) return;
    const profileId = id.startsWith("unlinked:") ? id.slice("unlinked:".length) : id;
    router.replace(`${basePath}/${profileId}`);
  }, [basePath, router]);

  const visible = owners.filter((owner) => {
    const name = (owner.name || "Unnamed owner").toLowerCase();
    return !q.trim() || name.includes(q.trim().toLowerCase());
  });
  const mandatesPath = basePath.replace(/\/owners$/, "/mandates");
  const openSeller = (owner: Owner) => {
    const id = owner.contactId.startsWith("unlinked:") || owner.contactId.startsWith("company:")
      ? owner.opportunityIds?.[0]
      : owner.contactId;
    if (id) router.push(`${basePath}/${id}`);
  };

  return (
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        mobileTitle
        context="Property acquisition"
        title="Sellers"
        description="People with a property on file."
        actions={<Link href={mandatesPath} className="re-focus inline-flex h-11 items-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">New seller form</Link>}
      />
      <label>
        <span className="sr-only">Search sellers</span>
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
          <ul>
            {visible.map((owner) => {
              const name = owner.name || "Unnamed owner";
              const owned = (row: { id: string; contact_id: string | null }) => owner.opportunityIds?.length
                ? owner.opportunityIds.includes(row.id)
                : (owner.contactId.startsWith("unlinked:") ? `unlinked:${row.id}` === owner.contactId : row.contact_id === owner.contactId);
              const places = opportunities
                .filter((row) => owned(row))
                .map((row) => row.suburb || row.city)
                .filter((value): value is string => Boolean(value))
                .slice(0, 1);
              return (
                <WorkLine
                  key={owner.contactId}
                  name={name}
                  meta={places[0] || (owner.kind === "company" ? "Company" : "Seller")}
                  detail={`${owner.properties} ${owner.properties === 1 ? "property" : "properties"} · ${owner.active} active`}
                  action="Open"
                  onClick={() => openSeller(owner)}
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}

    </div>
  );
}

const INSPECTION_FILTERS = [
  { id: "record", label: "To record" },
  { id: "recorded", label: "Recorded" },
  { id: "all", label: "All" },
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
    if (filter === "recorded") return status === "completed";
    return status !== "completed" && status !== "cancelled";
  });

  return (
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        mobileTitle
        context="Property acquisition"
        title="Inspections"
        description="Visits to prepare a property for the market."
      />
      <FilterChips label="Inspection filter" value={filter} options={INSPECTION_FILTERS} onChange={setFilter} />
      {incomplete ? <RePartialNotice>Some inspections could not be loaded. This list may be short.</RePartialNotice> : null}
      {error ? <ReErrorState title="Inspections didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading inspections" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReEmptyState
          framed
          title={filter === "all" ? "No inspections yet" : "No inspections in this view"}
          description={filter === "all" ? "Open a house from a seller and record the visit there." : "Nothing in this filter."}
          action={<Link href={opportunityBase.replace("/acquisitions", "/owners")} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open sellers</Link>}
        />
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ReSection id="inspections" title="Inspections" count={visible.length} flush>
          <ul>
            {visible.map((row) => {
              const label = String(row.suburb || row.address || "Inspection");
              const status = String(row.status ?? "");
              const action = status === "completed" ? "Open" : row.scheduled_at ? "Record" : "Book";
              return (
                <WorkLine
                  key={String(row.id)}
                  name={label}
                  meta={String(row.owner_name || row.seller_name || "Seller")}
                  detail={row.scheduled_at ? formatWhen(String(row.scheduled_at)) ?? "Not scheduled" : "Not scheduled"}
                  action={action}
                  href={`${opportunityBase}/${String(row.opportunity_id)}#acq-inspection`}
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}
    </div>
  );
}

const MANDATE_FILTERS: Array<{ id: MandateFormFilter; label: string }> = [
  { id: "with_seller", label: "Waiting" },
  { id: "complete", label: "Accepted" },
  { id: "all", label: "All" },
];

type MandateFormRow = {
  id: string;
  phase: "with_seller" | "complete";
  kind: string | null;
  sellerName: string;
  property: string;
  expiryDate: string | null;
  contactId: string | null;
  opportunityId: string | null;
};

type MandateSheet = MandateFormRow & {
  listingId: string | null;
  busy: boolean;
  error: string | null;
};

function mandateWhen(kind: string | null, expiryDate: string | null) {
  if (expiryDate) return `Ends ${expiryDate}`;
  if (kind === "sole") return "No end date";
  return "End date not set";
}

export function MandateList({ clientId, opportunityBase, framed = false }: { clientId: string; opportunityBase: string; framed?: boolean }) {
  const [rows, setRows] = useState<MandateFormRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MandateFormFilter>("all");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<MandateSheet | null>(null);
  const root = opportunityBase.replace(/\/acquisitions$/, "");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/mandate-forms`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!quiet) setLoading(false);
    if (!res.ok) {
      if (!quiet) setError(json.error ?? "Could not load mandates.");
      return;
    }
    setError(null);
    setRows(json.forms ?? []);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = query.trim().toLowerCase();
  const matched = rows.filter((row) => {
    if (!needle) return true;
    return `${row.sellerName} ${row.property}`.toLowerCase().includes(needle);
  });
  const visible = matched.filter((row) => mandateFormVisible(row, filter));

  const openForm = async (row: MandateFormRow) => {
    setSheet({ ...row, listingId: null, busy: row.phase === "complete", error: null });
    if (row.phase !== "complete") return;
    const res = await fetch(`/api/clients/${clientId}/mandate-forms/${row.id}/open`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setSheet((current) => {
      if (!current || current.id !== row.id) return current;
      if (!res.ok) return { ...current, busy: false, error: json.error ?? "Could not open this mandate." };
      return {
        ...current,
        busy: false,
        error: null,
        sellerName: json.sellerName ?? current.sellerName,
        property: json.property ?? current.property,
        kind: json.kind ?? current.kind,
        expiryDate: json.expiryDate ?? current.expiryDate,
        contactId: json.contactId ?? null,
        opportunityId: json.opportunityId ?? null,
        listingId: json.listingId ?? null,
      };
    });
    if (res.ok) void load(true);
  };

  return (
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        mobileTitle
        context="Property acquisition"
        title="Mandates"
        description="Forms returned by sellers, and the mandates on file."
      />
      <SellerIntakePanel clientId={clientId} mode="send" />
      <label>
        <span className="sr-only">Search mandates</span>
        <input className={acqFieldClass} placeholder="Search seller or property" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <FilterChips label="Mandate filter" value={filter} options={MANDATE_FILTERS} onChange={setFilter} />
      {error ? <ReErrorState title="Mandates didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading mandates" /> : null}
      {!loading && !error && visible.length === 0 ? (
        <ReEmptyState
          framed
          title={rows.length === 0 ? "No seller forms yet" : "Nothing in this view"}
          description={rows.length === 0 ? "Send the form above. It stays here until the seller finishes it." : "Try another filter or a different seller or property."}
        />
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ReSection id="mandates" title="Mandates" count={visible.length} flush>
          <ul>
            {visible.map((row) => (
              <WorkLine
                key={row.id}
                name={row.sellerName}
                meta={row.property}
                detail={row.phase === "complete" ? `Accepted · ${mandateKindLabel(row.kind)} · ${mandateWhen(row.kind, row.expiryDate)}` : "Waiting for the form"}
                action="Open"
                onClick={() => void openForm(row)}
              />
            ))}
          </ul>
        </ReSection>
      ) : null}

      {sheet ? (
        <ReSheet
          title={sheet.property}
          description={sheet.phase === "complete" ? "Complete" : "With the seller"}
          onClose={() => setSheet(null)}
        >
          <dl className="mb-4 space-y-2 text-[13px]">
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">Seller</dt><dd className="text-right">{sheet.sellerName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">Type</dt><dd>{mandateKindLabel(sheet.kind)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-sales-text-muted">End</dt><dd>{mandateWhen(sheet.kind, sheet.expiryDate)}</dd></div>
          </dl>
          {sheet.busy ? <p className="text-[13px] text-sales-text-secondary">Opening the seller and the draft listing.</p> : null}
          {sheet.error ? <p className="text-[13px] text-sales-text-secondary">{sheet.error}</p> : null}
          {!sheet.busy && sheet.phase !== "complete" ? (
            <p className="text-[13px] leading-5 text-sales-text-secondary">This form is still with the seller. When they finish it, open it again. That creates their seller profile and a draft listing.</p>
          ) : null}
          {!sheet.busy && sheet.phase === "complete" && !sheet.error ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-5 text-sales-text-secondary">The seller and the draft listing are ready. The answers, the PDF, and the compliance check stay on the seller. Photos and the rest of the house are added on the listing.</p>
              <div className="flex flex-wrap gap-2">
                {sheet.contactId || sheet.opportunityId ? (
                  <Link href={`${root}/owners/${sheet.contactId || sheet.opportunityId}`} className="inline-flex min-h-11 items-center rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface">Open seller</Link>
                ) : null}
                {sheet.listingId ? (
                  <Link href={`${root}/listings/${sheet.listingId}`} className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold">Open listing</Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </ReSheet>
      ) : null}
    </div>
  );
}
