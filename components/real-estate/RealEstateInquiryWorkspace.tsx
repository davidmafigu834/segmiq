"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  FileText,
  MoreHorizontal,
  Phone,
  Search,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { DealSideBadge } from "@/components/real-estate/DealSideBadge";
import { ScheduleViewingPanel } from "@/components/real-estate/ScheduleViewingPanel";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import type { ReInquiryWorkspace } from "@/lib/sales/get-real-estate-inquiry-workspace";
import {
  BUYER_TIMELINE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from "@/lib/real-estate/requirements";
import { RE_MANUAL_STAGES, rePipelineStageLabel } from "@/lib/real-estate/pipeline";
import { CreateOfferSheet, type CreateOfferPrefill } from "@/components/real-estate/offers/CreateOfferSheet";
import {
  InquiryOffersSection,
  OfferDetailPanel,
} from "@/components/real-estate/offers/OfferDetailPanel";
import { InquiryComplianceCard } from "@/components/real-estate/compliance/InquiryComplianceCard";

type TabId = "overview" | "requirements" | "matches" | "viewings" | "offers" | "activity";

export function RealEstateInquiryWorkspace({
  clientId,
  leadId,
  onClose,
  onCall,
  onWhatsApp,
  overlay,
  stacked,
}: {
  clientId: string;
  leadId: string;
  onClose: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  overlay?: boolean;
  stacked?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<ReInquiryWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<"log" | "followup" | "stage" | "picker" | "schedule" | null>(null);
  const [scheduleListingId, setScheduleListingId] = useState<string | null>(null);
  const [createOffer, setCreateOffer] = useState<CreateOfferPrefill | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/leads/${leadId}/real-estate`);
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { workspace: ReInquiryWorkspace };
      setData(json.workspace);
    } catch {
      setError("Could not load this inquiry.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/clients/${clientId}/leads/${leadId}/real-estate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as { workspace: ReInquiryWorkspace };
      setData(json.workspace);
    }
    return res.ok;
  }

  const primary = data?.primaryAction;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
        overlay &&
          "fixed inset-y-0 right-0 z-40 w-full max-w-[440px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
        stacked && overlay && "inset-0 max-w-none rounded-none"
      )}
    >
      <header className="border-b border-sales-border-subtle px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-sales-text-primary">
                {data?.identity ?? "Inquiry"}
              </h2>
              <DealSideBadge dealSide={data?.dealSide} />
            </div>
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              {data?.stageLabel ?? "—"}
              {data?.ownerName ? ` · ${data.ownerName}` : " · Unassigned"}
              {data?.sourceLabel ? ` · ${data.sourceLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] px-2 py-1 text-[12px] text-sales-text-muted hover:bg-sales-surface-hover"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <IconAction label="Call" onClick={onCall} disabled={!data?.phone}>
            <Phone size={14} />
          </IconAction>
          <IconAction label="WhatsApp" onClick={onWhatsApp} disabled={!data?.phone && !data?.email}>
            <SiWhatsapp size={14} />
          </IconAction>
          <IconAction label="Log call" onClick={() => setSheet("log")}>
            <FileText size={14} />
          </IconAction>
          <IconAction label="Follow-up" onClick={() => setSheet("followup")}>
            <Calendar size={14} />
          </IconAction>
          <div className="relative ml-auto">
            <IconAction label="More" onClick={() => setSheet(sheet === "stage" ? null : "stage")}>
              <MoreHorizontal size={14} />
            </IconAction>
          </div>
        </div>

        {data?.guidance ? (
          <p className="mt-3 rounded-[10px] border border-sales-border-subtle bg-sales-surface-subtle px-3 py-2 text-[12px] leading-relaxed text-sales-text-secondary">
            <span className="font-medium text-sales-text-primary">Recommended: </span>
            {data.guidance}
          </p>
        ) : null}

        {data?.suggestedStage ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-[10px] border border-sales-border-subtle px-3 py-2">
            <p className="text-[12px] text-sales-text-secondary">
              Suggested next stage: {rePipelineStageLabel(data.suggestedStage)}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void patch({ stage: data.suggestedStage })}
            >
              Move to Interested
            </Button>
          </div>
        ) : null}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-sales-border-subtle px-3">
        {(
          [
            ["overview", "Overview"],
            ["requirements", "Requirements"],
            ["matches", "Matches"],
            ["viewings", "Viewings"],
            ["offers", "Offers"],
            ["activity", "Activity"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative h-10 shrink-0 px-2.5 text-[12px] font-medium",
              tab === id ? "text-sales-text-primary" : "text-sales-text-secondary"
            )}
          >
            {label}
            {tab === id ? (
              <span className="absolute inset-x-1 -bottom-px h-[2px] bg-sales-brand" />
            ) : null}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {loading ? (
          <p className="text-[13px] text-sales-text-muted">Loading…</p>
        ) : error ? (
          <p className="text-[13px] text-sales-danger">{error}</p>
        ) : data ? (
          <>
            {tab === "overview" ? (
              <OverviewTab data={data} clientId={clientId} leadId={leadId} />
            ) : null}
            {tab === "requirements" ? (
              <RequirementsTab
                clientId={clientId}
                data={data}
                onSaved={() => void load()}
              />
            ) : null}
            {tab === "matches" ? (
              <MatchesTab
                data={data}
                onFind={() => setSheet("picker")}
                onAddRequirements={() => setTab("requirements")}
                onInterested={(id) => void patch({ interested_listing_id: id })}
                onLink={(id) => void patch({ linked_listing_id: id })}
                onSchedule={(id) => {
                  setScheduleListingId(id);
                  setSheet("schedule");
                }}
                onCreateOffer={(id) =>
                  setCreateOffer({
                    listingId: id,
                    contactId: data.contactId,
                    contactName: data.identity,
                    leadId,
                  })
                }
                onSend={async (listingId) => {
                  if (!data.contactId) return;
                  await fetch(`/api/clients/${clientId}/listings/${listingId}/send-match`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contact_id: data.contactId }),
                  });
                  void load();
                }}
              />
            ) : null}
            {tab === "viewings" ? (
              <ViewingsTab
                clientId={clientId}
                data={data}
                onSchedule={() => {
                  setScheduleListingId(data.linkedListing?.id ?? data.interested[0]?.id ?? null);
                  setSheet("schedule");
                }}
                onChanged={() => void load()}
                onCreateOffer={(listingId) =>
                  setCreateOffer({
                    listingId,
                    contactId: data.contactId,
                    contactName: data.identity,
                    leadId,
                  })
                }
              />
            ) : null}
            {tab === "offers" ? (
              <InquiryOffersSection
                clientId={clientId}
                leadId={leadId}
                contactId={data.contactId}
                contactName={data.identity}
                defaultListingId={data.linkedListing?.id ?? data.interested[0]?.id ?? null}
                onOpen={setOpenOfferId}
                onCreate={setCreateOffer}
              />
            ) : null}
            {tab === "activity" ? <LeadTimeline leadId={leadId} /> : null}
          </>
        ) : null}
      </div>

      {data && primary && primary.id !== "none" ? (
        <div className="border-t border-sales-border-subtle px-4 py-3 sm:px-5">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => {
              if (primary.id === "contact") onCall();
              else if (primary.id === "requirements") setTab("requirements");
              else if (primary.id === "find_property") {
                setTab("matches");
                setSheet("picker");
              } else if (primary.id === "schedule_viewing") {
                setTab("viewings");
                setSheet("schedule");
              }               else if (primary.id === "complete_viewing") setTab("viewings");
              else if (primary.id === "offer") {
                setTab("offers");
                if (data?.contactId) {
                  setCreateOffer({
                    listingId: data.linkedListing?.id ?? data.interested[0]?.id ?? null,
                    contactId: data.contactId,
                    contactName: data.identity,
                    leadId,
                  });
                }
              }
              else if (primary.id === "follow_up") setSheet("followup");
              else setSheet("followup");
            }}
          >
            {primary.label}
          </Button>
        </div>
      ) : null}

      {sheet === "log" ? (
        <PremiumSheet title="Log call" onClose={() => setSheet(null)} size="md">
          <LogCallForm
            leadId={leadId}
            appearance="premium"
            variant="compact"
            clientId={clientId}
            onLogged={() => {
              setSheet(null);
              void load();
            }}
          />
        </PremiumSheet>
      ) : null}

      {sheet === "followup" && data ? (
        <FollowUpSheet
          current={data.followUpAt}
          onClose={() => setSheet(null)}
          onSave={async (iso) => {
            await patch({ follow_up_date: iso });
            setSheet(null);
          }}
        />
      ) : null}

      {sheet === "stage" && data ? (
        <PremiumSheet title="Change stage" onClose={() => setSheet(null)} size="sm">
          <ul className="space-y-1">
            {RE_MANUAL_STAGES.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="w-full rounded-[8px] px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover"
                  onClick={() => {
                    void patch({ stage: id });
                    setSheet(null);
                  }}
                >
                  {rePipelineStageLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </PremiumSheet>
      ) : null}

      {sheet === "picker" && data ? (
        <ListingPickerSheet
          clientId={clientId}
          onClose={() => setSheet(null)}
          onSelect={(id) => {
            void patch({ interested_listing_id: id });
            setSheet(null);
            setTab("matches");
          }}
        />
      ) : null}

      {sheet === "schedule" && data?.contactId ? (
        <PremiumSheet title="Schedule viewing" onClose={() => setSheet(null)} size="md">
          <ScheduleViewingPanel
            clientId={clientId}
            contactId={data.contactId}
            interestedListingIds={data.interested.map((l) => l.id)}
            defaultListingId={scheduleListingId}
            embedded
            defaultOpen
            onScheduled={() => {
              setSheet(null);
              void load();
            }}
            onCancel={() => setSheet(null)}
          />
        </PremiumSheet>
      ) : null}

      {createOffer ? (
        <CreateOfferSheet
          clientId={clientId}
          prefill={createOffer}
          onClose={() => setCreateOffer(null)}
          onCreated={(id) => {
            setCreateOffer(null);
            setOpenOfferId(id);
            setTab("offers");
            void load();
          }}
        />
      ) : null}

      {openOfferId ? (
        <OfferDetailPanel
          clientId={clientId}
          offerId={openOfferId}
          complianceHref="/client/compliance"
          onClose={() => setOpenOfferId(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </aside>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-sales-border px-2.5 text-[11px] font-medium text-sales-text-secondary disabled:opacity-40 hover:bg-sales-surface-hover"
    >
      {children}
      {label}
    </button>
  );
}

function OverviewTab({
  data,
  clientId,
  leadId,
}: {
  data: ReInquiryWorkspace;
  clientId: string;
  leadId: string;
}) {
  return (
    <div className="space-y-4 text-[13px]">
      <InquiryComplianceCard
        clientId={clientId}
        leadId={leadId}
        contactId={data.contactId}
        listingId={data.linkedListing?.id ?? null}
        offerStatus={data.offerStatus}
      />
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact label="Phone" value={data.phone} />
        <Fact label="Email" value={data.email} />
        <Fact label="Agent" value={data.ownerName} />
        <Fact label="Source" value={data.attribution?.sourceLabel ?? data.sourceLabel} />
        <Fact label="Stage" value={data.stageLabel} />
        <Fact
          label="Follow-up"
          value={
            data.followUpAt
              ? new Date(data.followUpAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null
          }
        />
      </dl>
      {data.attribution ? (
        <section className="rounded-[12px] border border-sales-border-subtle bg-sales-surface-subtle/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            Attribution
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Fact label="Source" value={data.attribution.sourceLabel} />
            <Fact label="Campaign" value={data.attribution.campaignName} />
            <Fact label="Ad" value={data.attribution.adName} />
            <Fact
              label="Originating property"
              value={data.attribution.propertyLabel ?? data.linkedListing?.label ?? null}
            />
            <Fact
              label="Captured"
              value={
                data.attribution.capturedAt
                  ? new Date(data.attribution.capturedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null
              }
            />
            <Fact label="Referred by" value={data.attribution.referralSourceName} />
          </dl>
          {data.attribution.formPrequalified ? (
            <p className="mt-2 text-[12px] text-sales-text-secondary">
              Pre-qualified by form — not yet confirmed by an agent.
            </p>
          ) : null}
          {data.attribution.latestSourceLabel ? (
            <p className="mt-1 text-[12px] text-sales-text-muted">
              Latest source: {data.attribution.latestSourceLabel} (original source preserved)
            </p>
          ) : null}
        </section>
      ) : null}
      {data.demandSide ? (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            Property requirements
          </p>
          <p className="mt-1 text-sales-text-primary">
            {data.requirementSummary ?? "Not captured yet"}
          </p>
          {data.budgetLabel ? (
            <p className="mt-0.5 text-sales-text-secondary">{data.budgetLabel}</p>
          ) : null}
          <p className="mt-2 text-[12px] text-sales-text-muted">
            {data.completeness.statusLabel} · {data.completeness.summary}
          </p>
        </section>
      ) : null}
      {data.supplySide || data.linkedListing ? (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            Linked property
          </p>
          {data.linkedListing ? (
            <Link
              href={`/client/listings/${data.linkedListing.id}`}
              className="mt-1 block font-medium text-sales-text-primary hover:underline"
            >
              {data.linkedListing.label}
            </Link>
          ) : (
            <p className="mt-1 text-sales-text-muted">No linked listing</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-sales-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sales-text-primary">{value || "—"}</dd>
    </div>
  );
}

function RequirementsTab({
  clientId,
  data,
  onSaved,
}: {
  clientId: string;
  data: ReInquiryWorkspace;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [min, setMin] = useState(data.requirements.buyer_budget_min?.toString() ?? "");
  const [max, setMax] = useState(data.requirements.buyer_budget_max?.toString() ?? "");
  const [beds, setBeds] = useState(data.requirements.buyer_bedrooms_wanted?.toString() ?? "");
  const [area, setArea] = useState(data.requirements.buyer_area_preference ?? "");
  const [timeline, setTimeline] = useState(data.requirements.buyer_timeline ?? "");
  const [propertyType, setPropertyType] = useState(data.requirements.propertyType ?? "");
  const [notes, setNotes] = useState(data.requirements.notes ?? "");

  if (!data.demandSide) {
    return (
      <p className="text-[13px] text-sales-text-secondary">
        Seller and landlord inquiries focus on the linked listing rather than buyer requirements.
      </p>
    );
  }

  if (!data.contactId) {
    return (
      <p className="text-[13px] text-sales-text-secondary">
        This inquiry has no contact record yet, so requirements cannot be saved.
      </p>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/contacts/${data.contactId}/requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: data.leadId,
          buyer_budget_min: min ? Number(min) : null,
          buyer_budget_max: max ? Number(max) : null,
          buyer_bedrooms_wanted: beds ? Number(beds) : null,
          buyer_area_preference: area || null,
          buyer_timeline: timeline || null,
          property_type: propertyType || null,
          notes: notes || null,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-sales-text-muted">
        {data.completeness.statusLabel} · {data.completeness.summary}
      </p>
      <label className="block text-[12px]">
        <span className="text-sales-text-muted">Property type</span>
        <select
          className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        >
          <option value="">Select</option>
          {PROPERTY_TYPE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[12px]">
        <span className="text-sales-text-muted">Preferred areas</span>
        <input
          className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Burnside, Hillside"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[12px]">
          <span className="text-sales-text-muted">Min budget</span>
          <input
            type="number"
            className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="120000"
          />
        </label>
        <label className="block text-[12px]">
          <span className="text-sales-text-muted">Max budget</span>
          <input
            type="number"
            className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="170000"
          />
        </label>
      </div>
      <label className="block text-[12px]">
        <span className="text-sales-text-muted">Bedrooms</span>
        <input
          type="number"
          className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
          placeholder="3"
        />
      </label>
      <label className="block text-[12px]">
        <span className="text-sales-text-muted">Timeline</span>
        <select
          className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
        >
          <option value="">Select</option>
          {BUYER_TIMELINE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[12px]">
        <span className="text-sales-text-muted">Additional requirements</span>
        <textarea
          className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 py-2"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Borehole, walled property, cottage…"
        />
      </label>
      <Button variant="primary" size="md" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save requirements"}
      </Button>
    </div>
  );
}

function MatchesTab({
  data,
  onFind,
  onAddRequirements,
  onInterested,
  onLink,
  onSchedule,
  onCreateOffer,
  onSend,
}: {
  data: ReInquiryWorkspace;
  onFind: () => void;
  onAddRequirements: () => void;
  onInterested: (id: string) => void;
  onLink: (id: string) => void;
  onSchedule: (id: string) => void;
  onCreateOffer: (id: string) => void;
  onSend: (id: string) => void;
}) {
  if (!data.completeness.ready) {
    return (
      <div className="text-center">
        <p className="text-[13px] font-medium text-sales-text-primary">No property matches yet</p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          Add the client’s preferred area, budget and bedroom requirements to start matching available listings.
        </p>
        <Button variant="primary" size="sm" className="mt-4" onClick={onAddRequirements}>
          Add requirements
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-sales-text-muted">{data.matches.length} matching listings</p>
        <Button variant="secondary" size="sm" onClick={onFind}>
          <Search size={13} className="mr-1" />
          Find property
        </Button>
      </div>
      {data.interested.length > 0 ? (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            Interested properties
          </p>
          <ul className="mt-2 space-y-2">
            {data.interested.map((l) => {
              const viewing = data.viewings.find(
                (v) => v.listingId === l.id && v.status === "scheduled"
              );
              return (
                <li key={l.id} className="rounded-[10px] border border-sales-border-subtle px-3 py-2">
                  <p className="text-[13px] font-medium">{l.label}</p>
                  <p className="text-[12px] text-sales-text-secondary">
                    {l.priceLabel ?? "Price on request"}
                    {viewing ? " · Viewing scheduled" : ` · ${l.status.replace(/_/g, " ")}`}
                  </p>
                  <button
                    type="button"
                    className="mt-2 rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                    onClick={() => onSchedule(l.id)}
                  >
                    Viewing
                  </button>
                  <button
                    type="button"
                    className="mt-2 ml-1.5 rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                    onClick={() => onCreateOffer(l.id)}
                  >
                    Create offer
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {data.matches.length === 0 ? (
        <p className="text-[13px] text-sales-text-secondary">
          No available listings currently match these requirements. Try Find property to browse stock.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.matches.map((m) => (
            <li key={m.id} className="rounded-[12px] border border-sales-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold">{m.label}</p>
                  <p className="text-[12px] text-sales-text-secondary">
                    {m.priceLabel ?? "Price on request"}
                    {m.bedrooms != null ? ` · ${m.bedrooms} Bed` : ""}
                    {m.bathrooms != null ? ` · ${m.bathrooms} Bath` : ""}
                  </p>
                </div>
                <span className="rounded-[6px] border border-sales-border-subtle px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-sales-text-muted">
                  {m.matchLabel}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-sales-text-secondary">
                {m.reasons.filter((r) => r.met).map((r) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <Check size={11} className="text-sales-success-fg" />
                    {r.label}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link
                  href={`/client/listings/${m.id}`}
                  className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                >
                  Open
                </Link>
                <button
                  type="button"
                  className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                  onClick={() => onInterested(m.id)}
                >
                  Interested
                </button>
                <button
                  type="button"
                  className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                  onClick={() => onLink(m.id)}
                >
                  Link
                </button>
                <button
                  type="button"
                  className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                  onClick={() => onSchedule(m.id)}
                >
                  Viewing
                </button>
                <button
                  type="button"
                  className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                  onClick={() => onSend(m.id)}
                >
                  Send
                </button>
                <button
                  type="button"
                  className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
                  onClick={() => onCreateOffer(m.id)}
                >
                  Offer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewingsTab({
  clientId,
  data,
  onSchedule,
  onChanged,
  onCreateOffer,
}: {
  clientId: string;
  data: ReInquiryWorkspace;
  onSchedule: () => void;
  onChanged: () => void;
  onCreateOffer: (listingId: string) => void;
}) {
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [sentiment, setSentiment] = useState<"positive" | "neutral" | "negative">("neutral");
  const [feedback, setFeedback] = useState("");
  const [offerNudge, setOfferNudge] = useState<{ listingId: string; label: string } | null>(null);

  const upcoming = data.viewings.filter((v) => v.status === "scheduled");
  const past = data.viewings.filter((v) => v.status !== "scheduled");

  async function complete(id: string) {
    await fetch(`/api/clients/${clientId}/viewings?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        feedback_sentiment: sentiment,
        feedback_text: feedback || null,
      }),
    });
    setCompleteId(null);
    setFeedback("");
    if (sentiment === "positive") {
      const row = upcoming.find((x) => x.id === id);
      if (row) setOfferNudge({ listingId: row.listingId, label: row.listingLabel });
    }
    onChanged();
  }

  async function cancel(id: string) {
    await fetch(`/api/clients/${clientId}/viewings?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    onChanged();
  }

  async function reschedule(id: string) {
    if (!rescheduleAt) return;
    await fetch(`/api/clients/${clientId}/viewings?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_at: new Date(rescheduleAt).toISOString() }),
    });
    setRescheduleId(null);
    setRescheduleAt("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <Button variant="secondary" size="sm" onClick={onSchedule} disabled={!data.contactId}>
        Schedule viewing
      </Button>
      {offerNudge ? (
        <div className="rounded-[12px] border border-sales-border bg-sales-neutral-50 p-3">
          <p className="text-[14px] font-medium">Client is interested.</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">{offerNudge.label}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => onCreateOffer(offerNudge.listingId)}
          >
            Create offer
          </Button>
        </div>
      ) : null}
      {upcoming.length === 0 && past.length === 0 ? (
        <p className="text-[13px] text-sales-text-secondary">
          No viewings yet. Match a property, then schedule from here.
        </p>
      ) : null}
      {upcoming.map((v) => (
        <div key={v.id} className="rounded-[12px] border border-sales-border p-3">
          <p className="text-[13px] font-semibold">{v.listingLabel}</p>
          <p className="text-[12px] text-sales-text-secondary">
            {new Date(v.scheduledAt).toLocaleString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {v.agentName ? ` · ${v.agentName}` : ""}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sales-text-muted">
            {v.status}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              href={`/client/listings/${v.listingId}`}
              className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
            >
              Open property
            </Link>
            <button
              type="button"
              className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
              onClick={() => {
                setRescheduleId(v.id);
                setRescheduleAt(v.scheduledAt.slice(0, 16));
              }}
            >
              Reschedule
            </button>
            <button
              type="button"
              className="rounded-[8px] border border-sales-border px-2 py-1 text-[11px]"
              onClick={() => void cancel(v.id)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-[8px] bg-sales-brand px-2 py-1 text-[11px] font-semibold text-sales-brand-text"
              onClick={() => setCompleteId(v.id)}
            >
              Complete viewing
            </button>
          </div>
          {rescheduleId === v.id ? (
            <div className="mt-3 space-y-2 border-t border-sales-border-subtle pt-3">
              <input
                type="datetime-local"
                className="w-full rounded-[8px] border border-sales-border px-2.5 py-2 text-[12px]"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
              />
              <Button variant="primary" size="sm" onClick={() => void reschedule(v.id)}>
                Save new time
              </Button>
            </div>
          ) : null}
          {completeId === v.id ? (
            <div className="mt-3 space-y-2 border-t border-sales-border-subtle pt-3">
              <p className="text-[12px] font-medium">Client interest</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["negative", "Not interested"],
                    ["neutral", "Maybe"],
                    ["positive", "Interested"],
                    ["positive", "Very interested"],
                  ] as const
                ).map(([id, label], i) => (
                  <button
                    key={`${id}-${i}`}
                    type="button"
                    onClick={() => setSentiment(id)}
                    className={cn(
                      "rounded-[8px] border px-2 py-1 text-[11px]",
                      sentiment === id
                        ? "border-sales-brand bg-sales-brand/15"
                        : "border-sales-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full rounded-[8px] border border-sales-border px-2.5 py-2 text-[12px]"
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What did they think?"
              />
              <Button variant="primary" size="sm" onClick={() => void complete(v.id)}>
                Save outcome
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {past.map((v) => (
        <div key={v.id} className="rounded-[12px] border border-sales-border-subtle p-3 opacity-90">
          <p className="text-[13px] font-medium">{v.listingLabel}</p>
          <p className="text-[12px] text-sales-text-muted">
            {v.status.replace(/_/g, " ")}
            {v.feedbackSentiment ? ` · ${v.feedbackSentiment}` : ""}
          </p>
          {v.feedbackText ? (
            <p className="mt-1 text-[12px] text-sales-text-secondary">{v.feedbackText}</p>
          ) : null}
          {v.feedbackSentiment === "positive" ? (
            <div className="mt-2">
              <p className="text-[13px] font-medium">Client is interested.</p>
              <Button
                variant="primary"
                size="sm"
                className="mt-2"
                onClick={() => onCreateOffer(v.listingId)}
              >
                Create offer
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FollowUpSheet({
  current,
  onClose,
  onSave,
}: {
  current: string | null;
  onClose: () => void;
  onSave: (iso: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState(current ? current.slice(0, 16) : "");
  return (
    <PremiumSheet title="Add follow-up" onClose={onClose} size="sm">
      <input
        type="datetime-local"
        className="w-full rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void onSave(value ? new Date(value).toISOString() : null)}
        >
          Save
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </PremiumSheet>
  );
}

function ListingPickerSheet({
  clientId,
  onClose,
  onSelect,
}: {
  clientId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [suburb, setSuburb] = useState("");
  const [tx, setTx] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      address: string | null;
      suburb: string | null;
      price: number | null;
      bedrooms: number | null;
      status: string;
      transaction_type?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: "available", limit: "40" });
    if (q.trim()) params.set("q", q.trim());
    if (suburb.trim()) params.set("suburb", suburb.trim());
    if (tx) params.set("transaction_type", tx);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    if (beds) params.set("bedrooms", beds);
    const res = await fetch(`/api/clients/${clientId}/listings?${params.toString()}`);
    const json = (await res.json()) as { listings?: typeof rows };
    setRows(json.listings ?? []);
    setLoading(false);
  }, [clientId, q, suburb, tx, minPrice, maxPrice, beds]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <PremiumSheet title="Find property" onClose={onClose} size="md">
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
          placeholder="Search address"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
          placeholder="Suburb"
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
        />
        <select
          className="rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
          value={tx}
          onChange={(e) => setTx(e.target.value)}
        >
          <option value="">Sale or rental</option>
          <option value="sale">Sale</option>
          <option value="rental">Rental</option>
          <option value="new_development">New development</option>
        </select>
        <input
          className="rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
          placeholder="Min beds"
          type="number"
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
        />
        <input
          className="rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
          placeholder="Min price"
          type="number"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          className="rounded-[8px] border border-sales-border px-2.5 py-2 text-[13px]"
          placeholder="Max price"
          type="number"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>
      <ul className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
        {loading ? <li className="text-[13px] text-sales-text-muted">Searching…</li> : null}
        {!loading && rows.length === 0 ? (
          <li className="text-[13px] text-sales-text-secondary">No available listings match.</li>
        ) : null}
        {rows.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="w-full rounded-[10px] border border-sales-border px-3 py-2 text-left hover:bg-sales-surface-hover"
              onClick={() => onSelect(l.id)}
            >
              <p className="text-[13px] font-medium">
                {[l.address, l.suburb].filter(Boolean).join(", ") || "Listing"}
              </p>
              <p className="text-[12px] text-sales-text-secondary">
                {l.price != null ? `US$${Number(l.price).toLocaleString("en-US")}` : "Price on request"}
                {l.bedrooms != null ? ` · ${l.bedrooms} Bed` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </PremiumSheet>
  );
}
