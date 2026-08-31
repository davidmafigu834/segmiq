"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  Badge,
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  IconButton,
  Input,
  MenuSelect,
  SearchInput,
  Select,
  TextArea,
} from "@/components/sales/ui";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  isClosedListingStatus,
  isManagedListing,
  LISTING_APPROVAL_LABEL,
  LISTING_STATUS_LABEL,
  LISTING_TYPE_LABEL,
  listingStatusTone,
} from "@/lib/real-estate/listings";
import type { ListingApprovalStatus, ListingRow, ListingStatus, ListingTransactionType } from "@/types";
import { cn } from "@/lib/ui/cn";

type AgentOption = { id: string; name: string };
type DevelopmentOption = { id: string; name: string };
type StatusTab = "all" | "available" | "under_offer" | "reserved" | "management" | "approval" | "closed";
type TypeFilter = "all" | ListingTransactionType;

type ListingForm = {
  transaction_type: ListingTransactionType;
  status: ListingStatus;
  price: string;
  bedrooms: string;
  bathrooms: string;
  size_sqm: string;
  address: string;
  suburb: string;
  description: string;
  agent_id: string;
  development_id: string;
  mandate_type: "" | "sole" | "joint" | "open";
  mandate_expiry_date: string;
  lease_term_months: string;
  external_reference: string;
  photos: string;
};

const EMPTY: ListingForm = {
  transaction_type: "sale",
  status: "available",
  price: "",
  bedrooms: "",
  bathrooms: "",
  size_sqm: "",
  address: "",
  suburb: "",
  description: "",
  agent_id: "",
  development_id: "",
  mandate_type: "",
  mandate_expiry_date: "",
  lease_term_months: "",
  external_reference: "",
  photos: "",
};

const TYPE_LABEL = LISTING_TYPE_LABEL;
const STATUS_LABEL = LISTING_STATUS_LABEL;
const statusTone = listingStatusTone;

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function money(value: number | null): string {
  if (value == null) return "—";
  return `$${Number(value).toLocaleString()}`;
}

function specLine(listing: ListingRow): string {
  const parts: string[] = [];
  if (listing.bedrooms != null) parts.push(`${listing.bedrooms} bed`);
  if (listing.bathrooms != null) parts.push(`${listing.bathrooms} bath`);
  if (listing.size_sqm != null) parts.push(`${listing.size_sqm} m²`);
  return parts.join(" · ");
}

function firstPhoto(listing: ListingRow): string | null {
  return Array.isArray(listing.photos) && listing.photos[0] ? listing.photos[0] : null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function ListingThumb({ listing }: { listing: ListingRow }) {
  const src = firstPhoto(listing);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-10 w-10 shrink-0 rounded-[8px] object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-sales-neutral-100 text-sales-text-muted">
      <Building2 size={16} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

export function ListingsManager({
  clientId,
  readOnly = false,
  canApprove = !readOnly,
  listingHref,
  hideAddButton = false,
  headerCreateNonce = 0,
  onSelectionChange,
}: {
  clientId: string;
  readOnly?: boolean;
  canApprove?: boolean;
  listingHref?: (id: string) => string;
  hideAddButton?: boolean;
  headerCreateNonce?: number;
  onSelectionChange?: (id: string | null) => void;
}) {
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [developments, setDevelopments] = useState<DevelopmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [form, setForm] = useState<ListingForm>(EMPTY);

  const hrefFor = listingHref ?? (canApprove ? (id: string) => `/client/listings/${id}` : undefined);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, teamRes, devRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/listings`),
        fetch(`/api/clients/${clientId}/users`),
        fetch(`/api/clients/${clientId}/developments`),
      ]);
      const listJson = (await listRes.json()) as { listings?: ListingRow[] };
      const teamJson = (await teamRes.json().catch(() => ({}))) as {
        users?: { id: string; name: string; role: string; also_sells?: boolean }[];
      };
      const members = teamJson.users ?? [];
      setAgents(
        members
          .filter((m) => m.role === "SALESPERSON" || m.also_sells)
          .map((m) => ({ id: m.id, name: m.name }))
      );
      const devJson = (await devRes.json()) as { developments?: DevelopmentOption[] };
      setDevelopments((devJson.developments ?? []).map((d) => ({ id: d.id, name: d.name })));
      setListings(listJson.listings ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (headerCreateNonce > 0 && !readOnly) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerCreateNonce]);

  const counts = useMemo(() => {
    const available = listings.filter((l) => l.status === "available").length;
    const underOffer = listings.filter((l) => l.status === "under_offer").length;
    const reserved = listings.filter((l) => l.status === "reserved").length;
    const management = listings.filter((l) => isManagedListing(l)).length;
    const approval = listings.filter((l) => l.approval_status === "pending_approval").length;
    const closed = listings.filter((l) => isClosedListingStatus(l.status)).length;
    return { available, underOffer, reserved, management, approval, closed, total: listings.length };
  }, [listings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      if (statusTab === "available" && l.status !== "available") return false;
      if (statusTab === "under_offer" && l.status !== "under_offer") return false;
      if (statusTab === "reserved" && l.status !== "reserved") return false;
      if (statusTab === "management" && !isManagedListing(l)) return false;
      if (statusTab === "approval" && l.approval_status !== "pending_approval") return false;
      if (statusTab === "closed" && !isClosedListingStatus(l.status)) return false;
      if (typeFilter !== "all" && l.transaction_type !== typeFilter) return false;
      if (!q) return true;
      return [l.address, l.suburb, l.external_reference, l.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [listings, statusTab, typeFilter, query]);

  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? null;
  const preview = listings.find((l) => l.id === previewId) ?? null;

  function selectPreview(id: string | null) {
    setPreviewId(id);
    onSelectionChange?.(id);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(listing: ListingRow) {
    setEditingId(listing.id);
    setForm({
      transaction_type: listing.transaction_type,
      status: listing.status,
      price: listing.price != null ? String(listing.price) : "",
      bedrooms: listing.bedrooms != null ? String(listing.bedrooms) : "",
      bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : "",
      size_sqm: listing.size_sqm != null ? String(listing.size_sqm) : "",
      address: listing.address ?? "",
      suburb: listing.suburb ?? "",
      description: listing.description ?? "",
      agent_id: listing.agent_id ?? "",
      development_id: listing.development_id ?? "",
      mandate_type: listing.mandate_type ?? "",
      mandate_expiry_date: listing.mandate_expiry_date ?? "",
      lease_term_months: listing.lease_term_months != null ? String(listing.lease_term_months) : "",
      external_reference: listing.external_reference ?? "",
      photos: Array.isArray(listing.photos) ? listing.photos.join("\n") : "",
    });
    setShowForm(true);
  }

  function buildPayload() {
    return {
      transaction_type: form.transaction_type,
      status: form.status,
      price: numOrNull(form.price),
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      size_sqm: numOrNull(form.size_sqm),
      address: form.address.trim() || null,
      suburb: form.suburb.trim() || null,
      description: form.description.trim() || null,
      agent_id: form.agent_id || null,
      development_id: form.development_id || null,
      mandate_type: form.mandate_type || null,
      mandate_expiry_date: form.mandate_expiry_date || null,
      lease_term_months: numOrNull(form.lease_term_months),
      external_reference: form.external_reference.trim() || null,
      photos: form.photos
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  async function setApproval(id: string, approval_status: ListingApprovalStatus) {
    const res = await fetch(`/api/clients/${clientId}/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_status }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast(j.error ?? "Approval failed");
      return;
    }
    setToast(approval_status === "approved" ? "Listing approved" : "Listing rejected");
    await load();
  }

  async function save() {
    setSaving(true);
    try {
      const payload = buildPayload();
      const url = editingId
        ? `/api/clients/${clientId}/listings/${editingId}`
        : `/api/clients/${clientId}/listings`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast(j.error ?? "Save failed");
        return;
      }
      setToast(
        editingId
          ? "Listing updated"
          : canApprove
            ? "Listing created"
            : "Listing submitted for approval"
      );
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this listing?")) return;
    await fetch(`/api/clients/${clientId}/listings/${id}`, { method: "DELETE" });
    setToast("Listing deleted");
    setShowForm(false);
    await load();
  }

  const statusTabs: Array<{ id: StatusTab; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.total },
    { id: "available", label: "Available", count: counts.available },
    { id: "under_offer", label: "Under offer", count: counts.underOffer },
    { id: "reserved", label: "Reserved", count: counts.reserved },
    { id: "management", label: "Management", count: counts.management },
    ...(canApprove ? [{ id: "approval" as const, label: "Approval", count: counts.approval }] : []),
    { id: "closed", label: "Sold / Rented", count: counts.closed },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5" aria-busy aria-label="Loading listings">
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer h-[118px] rounded-[14px]" />
          ))}
        </div>
        <div className="shimmer h-[280px] rounded-[14px]" />
      </div>
    );
  }

  const kpis = [
    { id: "available", label: "Available", value: counts.available, supporting: "On the market", icon: "companies" as const },
    { id: "under-offer", label: "Under offer", value: counts.underOffer, supporting: "In negotiation", icon: "deals" as const },
    { id: "reserved", label: "Reserved", value: counts.reserved, supporting: "Held", icon: "customers" as const },
    { id: "approval", label: "Pending approval", value: counts.approval, supporting: "Waiting on you", icon: "followups" as const },
    { id: "closed", label: "Sold / Rented", value: counts.closed, supporting: "Closed stock", icon: "won" as const },
  ];

  const table = (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <div
          className="scrollbar-hide flex min-w-0 gap-4 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Listing status"
        >
          {statusTabs.map((item) => {
            const active = statusTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusTab(item.id)}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[13px] transition-colors duration-150",
                  active
                    ? "font-semibold text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
                )}
              >
                {item.label}
                <span className="tabular-nums text-sales-text-muted">{item.count}</span>
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search address, suburb…"
            className="min-w-0 w-full sm:w-[240px]"
          />
          <MenuSelect
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as TypeFilter)}
            aria-label="Listing type"
            options={[
              { value: "all", label: "All types" },
              { value: "sale", label: "Sale" },
              { value: "rental", label: "Rental" },
              { value: "new_development", label: "Development" },
              { value: "property_management", label: "Management" },
            ]}
          />
          {!readOnly && !hideAddButton ? (
            <Button type="button" variant="primary" size="md" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Add listing
            </Button>
          ) : null}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
            title={listings.length === 0 ? "No listings yet" : "No listings match these filters"}
            description={
              listings.length === 0
                ? readOnly
                  ? "Stock added by your manager will appear here."
                  : "Add the first sale, rental, development, or managed property."
                : "Clear search or switch status to see more."
            }
            action={
              !readOnly && listings.length === 0 ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreate}>
                  Add listing
                </Button>
              ) : undefined
            }
            size="compact"
          />
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto md:block">
            <DataTableEl className="min-w-[860px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Property</DataTableTh>
                  <DataTableTh>Type</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                  <DataTableTh>Price</DataTableTh>
                  <DataTableTh>Agent</DataTableTh>
                  <DataTableTh className="text-right"> </DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((listing) => (
                  <DataTableRow
                    key={listing.id}
                    selected={listing.id === previewId}
                    className="h-[56px] cursor-pointer"
                    onClick={() => selectPreview(listing.id)}
                  >
                    <DataTableTd>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ListingThumb listing={listing} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                            {listingLabel(listing)}
                          </p>
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {specLine(listing) || listing.suburb || "—"}
                          </p>
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd className="text-[12px] text-sales-text-secondary">
                      {TYPE_LABEL[listing.transaction_type]}
                    </DataTableTd>
                    <DataTableTd>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={statusTone(listing.status)} appearance="soft">
                          {STATUS_LABEL[listing.status]}
                        </Badge>
                        {listing.approval_status && listing.approval_status !== "approved" ? (
                          <Badge
                            tone={listing.approval_status === "rejected" ? "danger" : "warning"}
                            appearance="soft"
                          >
                            {LISTING_APPROVAL_LABEL[listing.approval_status]}
                          </Badge>
                        ) : null}
                      </div>
                    </DataTableTd>
                    <DataTableTd className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                      {money(listing.price)}
                    </DataTableTd>
                    <DataTableTd className="text-[12px] text-sales-text-secondary">
                      {agentName(listing.agent_id) ?? "—"}
                    </DataTableTd>
                    <DataTableTd className="text-right">
                      {readOnly ? null : (
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canApprove && listing.approval_status === "pending_approval" ? (
                            <button
                              type="button"
                              className="rounded-[8px] px-2 py-1 text-[11px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
                              onClick={() => void setApproval(listing.id, "approved")}
                            >
                              Approve
                            </button>
                          ) : null}
                          {canApprove ||
                          listing.approval_status === "draft" ||
                          listing.approval_status === "pending_approval" ? (
                            <button
                              type="button"
                              className="rounded-[8px] p-1.5 text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                              onClick={() => openEdit(listing)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canApprove ? (
                            <button
                              type="button"
                              className="rounded-[8px] p-1.5 text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-danger-fg"
                              onClick={() => void remove(listing.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      )}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>
          <div className="divide-y divide-sales-border-subtle md:hidden">
            {filtered.map((listing) => (
              <button
                key={listing.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sales-surface-hover",
                  listing.id === previewId && "bg-sales-brand-soft"
                )}
                onClick={() => selectPreview(listing.id)}
              >
                <ListingThumb listing={listing} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                    {listingLabel(listing)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                    {TYPE_LABEL[listing.transaction_type]}
                    {" · "}
                    {money(listing.price)}
                    {specLine(listing) ? ` · ${specLine(listing)}` : ""}
                  </p>
                </div>
                <Badge tone={statusTone(listing.status)} appearance="soft" className="shrink-0">
                  {STATUS_LABEL[listing.status]}
                </Badge>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const panel = preview ? (
    <>
      {overlayPanel ? (
        <button
          type="button"
          aria-label="Close listing details"
          className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
          onClick={() => selectPreview(null)}
        />
      ) : null}
      <aside
        className={cn(
          "flex h-full min-h-[660px] flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
          overlayPanel &&
            "fixed inset-y-0 right-0 z-[70] w-full max-w-[410px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
          stackedSplit && overlayPanel && "inset-0 max-w-none rounded-none"
        )}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-sales-text-primary">
              {listingLabel(preview)}
            </h2>
            <p className="mt-0.5 text-[12px] text-sales-text-muted">
              {[TYPE_LABEL[preview.transaction_type], STATUS_LABEL[preview.status]].join(" · ")}
            </p>
          </div>
          <IconButton aria-label="Close listing details" onClick={() => selectPreview(null)}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
          {firstPhoto(preview) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstPhoto(preview)!}
              alt=""
              className="mb-3 h-40 w-full rounded-[10px] object-cover"
            />
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-[11px] text-sales-text-muted">Price</dt>
              <dd className="font-semibold tabular-nums">{money(preview.price)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-sales-text-muted">Size</dt>
              <dd>{specLine(preview) || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-sales-text-muted">Agent</dt>
              <dd>{agentName(preview.agent_id) ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-sales-text-muted">Reference</dt>
              <dd>{preview.external_reference || "—"}</dd>
            </div>
          </dl>
          {preview.description ? (
            <p className="mt-3 whitespace-pre-wrap text-[13px] text-sales-text-secondary">{preview.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-sales-border-subtle px-4 py-3 sm:px-5">
          {hrefFor ? (
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => {
                window.location.href = hrefFor(preview.id);
              }}
            >
              Open listing
            </Button>
          ) : null}
          {!readOnly ? (
            <Button variant="secondary" size="md" className="flex-1" onClick={() => openEdit(preview)}>
              Edit
            </Button>
          ) : null}
        </div>
      </aside>
    </>
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      {toast ? (
        <p className="rounded-[10px] border border-sales-border bg-sales-surface px-4 py-2 text-[13px] text-sales-text-primary">
          {toast}
        </p>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((item) => (
          <CompanyKpiCard
            key={item.id}
            item={{
              id: item.id,
              label: item.label,
              value: String(item.value),
              supporting: item.supporting,
              icon: item.icon,
            }}
          />
        ))}
      </div>

      {previewId && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,30%)]">
          {table}
          <div className="min-h-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        table
      )}

      {previewId && overlayPanel ? panel : null}
      {showForm && !readOnly ? (
        <PremiumSheet
          size="lg"
          title={editingId ? "Edit listing" : "New listing"}
          description="Sale, rental, development, or managed stock."
          onClose={() => setShowForm(false)}
          footer={
            <div className="flex items-center justify-between gap-2">
              {editingId && canApprove ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void remove(editingId)}>
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="md" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" size="md" disabled={saving} onClick={() => void save()}>
                  {saving ? "Saving…" : "Save listing"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select
                value={form.transaction_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, transaction_type: e.target.value as ListingTransactionType }))
                }
              >
                <option value="sale">Sale</option>
                <option value="rental">Rental</option>
                <option value="new_development">New development</option>
                <option value="property_management">Property management</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ListingStatus }))}
              >
                <option value="available">Available</option>
                <option value="under_offer">Under offer</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
                <option value="let">Rented (legacy)</option>
                <option value="under_management">Under management</option>
              </Select>
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Field>
            <Field label="Suburb">
              <Input value={form.suburb} onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))} />
            </Field>
            <Field label="Price">
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </Field>
            <Field label="Beds / baths / m²">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Beds"
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Baths"
                  value={form.bathrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="m²"
                  value={form.size_sqm}
                  onChange={(e) => setForm((f) => ({ ...f, size_sqm: e.target.value }))}
                />
              </div>
            </Field>
            <Field label="Agent">
              <Select
                value={form.agent_id}
                onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Development">
              <Select
                value={form.development_id}
                onChange={(e) => setForm((f) => ({ ...f, development_id: e.target.value }))}
              >
                <option value="">None</option>
                {developments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mandate">
              <Select
                value={form.mandate_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mandate_type: e.target.value as ListingForm["mandate_type"] }))
                }
              >
                <option value="">—</option>
                <option value="sole">Sole</option>
                <option value="joint">Joint</option>
                <option value="open">Open</option>
              </Select>
            </Field>
            <Field label="Mandate expiry">
              <Input
                type="date"
                value={form.mandate_expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, mandate_expiry_date: e.target.value }))}
              />
            </Field>
            {form.transaction_type === "rental" || form.transaction_type === "property_management" ? (
              <Field label="Lease term (months)">
                <Input
                  type="number"
                  value={form.lease_term_months}
                  onChange={(e) => setForm((f) => ({ ...f, lease_term_months: e.target.value }))}
                />
              </Field>
            ) : null}
            <Field label="External reference">
              <Input
                value={form.external_reference}
                onChange={(e) => setForm((f) => ({ ...f, external_reference: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-3 space-y-3">
            <Field label="Description">
              <TextArea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <Field label="Photo URLs (one per line)">
              <TextArea
                rows={3}
                className="font-mono text-[12px]"
                value={form.photos}
                onChange={(e) => setForm((f) => ({ ...f, photos: e.target.value }))}
              />
            </Field>
          </div>
        </PremiumSheet>
      ) : null}

    </div>
  );
}
