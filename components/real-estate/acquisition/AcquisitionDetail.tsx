"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, UserRound } from "lucide-react";
import { PRICE_TYPES, conversionDecision } from "@/lib/real-estate/acquisition-plan";
import { PROPERTY_CATEGORIES, PROPERTY_CATEGORY_LABEL } from "@/lib/real-estate/buyer-match";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell } from "@/components/real-estate/ui/workspace-shell";
import {
  ReActionMenu,
  ReDetailList,
  ReEmptyState,
  ReErrorState,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { MandateActions, uploadEvidence } from "./MandateActions";
import {
  acqFieldClass,
  acqLabelClass,
  evidenceFromBundle,
  formatWhen,
  inspectionStatusLabel,
  inspectionTone,
  intentLabel,
  isOverdue,
  mandateStatusLabel,
  mandateTone,
  mandateTypeLabel,
  placeLabel,
  priceTypeLabel,
  stageChoices,
  stageLabel,
} from "./acquisition-ui";

type Bundle = {
  opportunity: Record<string, unknown>;
  contact: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  events: Array<Record<string, unknown>>;
  inspections: Array<Record<string, unknown>>;
  photos: Array<Record<string, unknown>>;
  prices: Array<Record<string, unknown>>;
  mandates: Array<Record<string, unknown>>;
};

const shellClass =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-[var(--re-section-gap,16px)] overflow-y-auto overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:pb-6";

const INSPECTION_JUMPS = [
  ["inspect-place", "Property"],
  ["inspect-features", "Details"],
  ["inspect-utilities", "Utilities"],
  ["inspect-condition", "Condition"],
  ["inspect-photos", "Photos"],
  ["inspect-docs", "Documents"],
  ["inspect-notes", "Notes"],
] as const;

export function AcquisitionDetail({
  clientId,
  opportunityId,
  basePath,
  ownersPath,
  canReview,
  framed = false,
}: {
  clientId: string;
  opportunityId: string;
  basePath: string;
  ownersPath: string;
  canReview: boolean;
  framed?: boolean;
}) {
  const rootClass = framed ? reEmbeddedShell : shellClass;
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceType, setPriceType] = useState<string>(PRICE_TYPES[0]);
  const [stageOpen, setStageOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; caption: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch(`/api/clients/${clientId}/acquisitions/${opportunityId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Could not load");
    else {
      setBundle(json);
      setError(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, opportunityId]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/acquisitions/${opportunityId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Action failed");
      return json;
    }
    if (json.listingId) {
      window.location.href = basePath.includes("/sales") ? `/sales/listings` : `/client/listings/${json.listingId}`;
      return json;
    }
    await load();
    return json;
  }

  const evidence = useMemo(
    () =>
      bundle
        ? evidenceFromBundle({
            inspections: bundle.inspections,
            mandates: bundle.mandates,
            listingId: (bundle.opportunity.converted_listing_id as string | null) ?? null,
          })
        : null,
    [bundle]
  );

  if (!bundle && !error) {
    return (
      <div className={rootClass}>
        <ReSkeletonRows rows={6} label="Loading opportunity" />
      </div>
    );
  }
  if (!bundle || !evidence) {
    return (
      <div className={rootClass}>
        <ReErrorState title="This opportunity didn't load" description={error ?? "Try again."} onRetry={() => void load()} />
      </div>
    );
  }

  const opp = bundle.opportunity;
  const phone = bundle.contact?.phone || (opp.owner_phone as string | null);
  const title = placeLabel({
    suburb: opp.suburb as string | null,
    city: opp.city as string | null,
    address: opp.address as string | null,
  });
  const ownerName = bundle.contact?.name || (opp.owner_name as string) || "Owner not recorded";
  const listingId = (opp.converted_listing_id as string | null) ?? null;
  const listingHref = listingId ? (basePath.includes("/sales") ? "/sales/listings" : `/client/listings/${listingId}`) : null;
  const listingDecision = conversionDecision({
    existingListingId: listingId,
    hasValidMandate: evidence.hasValidMandate,
    managerOverride: canReview,
  });
  const overdue = isOverdue(opp.next_action_at as string | null, String(opp.status));
  const choices = stageChoices(evidence);
  const latestPrice = bundle.prices[0];

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }

  const stageName = String(opp.stage);
  const primary = listingHref
    ? { label: "Open listing", run: () => { window.location.href = listingHref; } }
    : stageName.includes("inspection")
      ? { label: "Continue inspection", run: () => jump("acq-inspection") }
      : stageName.startsWith("mandate")
        ? { label: "Discuss mandate", run: () => jump("acq-mandate") }
        : stageName === "pricing_discussion"
          ? { label: "Record price", run: () => jump("acq-pricing") }
          : stageName === "listing_preparation" || stageName === "submitted_for_approval"
            ? { label: "Prepare listing", run: () => jump("acq-listing") }
            : { label: "Record contact", run: () => setContactOpen(true) };

  const missing = [
    !phone ? "No phone number on the owner." : null,
    !(opp.suburb || opp.city || opp.address) ? "No location recorded." : null,
    !evidence.hasCompletedInspection ? "No completed inspection." : null,
    !evidence.hasValidMandate ? "No approved mandate that is still in date." : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className={rootClass}>
      <div>
        <Link href={basePath} className="re-focus inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-sales-text-secondary">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
          Back to opportunities
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-sales-text-primary [overflow-wrap:anywhere] layout:text-[28px]">
              {title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ReStatusBadge label={stageLabel(stageName)} />
              <ReStatusBadge label={intentLabel(String(opp.property_intent))} tone="neutral" />
              {opp.reference_number ? <span className="text-[12px] text-sales-text-muted">{String(opp.reference_number)}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={primary.run} disabled={busy} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>
              {primary.label}
            </button>
            <ReActionMenu
              label="Opportunity actions"
              sheetTitle={title}
              actions={[
                { id: "stage", label: "Change stage", onSelect: () => setStageOpen(true) },
                { id: "contact", label: "Record owner contact", onSelect: () => setContactOpen(true) },
                { id: "inspect", label: "Inspection form", onSelect: () => jump("acq-inspection") },
                { id: "hold", label: "Put on hold", disabled: String(opp.status) === "on_hold", onSelect: () => void act({ action: "outcome", status: "on_hold", reason: "Paused" }) },
                { id: "reopen", label: "Reopen", disabled: String(opp.status) === "active", onSelect: () => void act({ action: "outcome", status: "active" }) },
                { id: "lost", label: "Mark lost", destructive: true, disabled: String(opp.status) === "lost", onSelect: () => setLostOpen(true) },
              ]}
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}

      <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] layout:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-[var(--re-section-gap,16px)] layout:col-span-8">
          <ReSection
            id="acq-stage"
            title="Acquisition progress"
            description={`${stageLabel(stageName)}${String(opp.status) !== "active" ? ` · ${String(opp.status).replaceAll("_", " ")}` : ""}`}
            action={<button type="button" onClick={() => setStageOpen(true)} className="re-focus min-h-11 text-[13px] font-semibold underline-offset-2 hover:underline sm:min-h-0">Change stage</button>}
          >
            <p className="text-[13px] text-sales-text-secondary">
              Inspection, mandate and listing stages still need the records they require. Choosing a stage does not create them.
            </p>
          </ReSection>

          <OwnerBlock ownerName={ownerName} phone={phone} email={bundle.contact?.email ?? null} ownersPath={ownersPath} contactId={bundle.contact?.id ?? null} />

          <ReSection id="acq-followup" title="Next step" action={<button type="button" className="re-focus min-h-11 text-[13px] font-semibold underline-offset-2 hover:underline sm:min-h-0" onClick={() => setContactOpen(true)}>Record contact</button>}>
            {opp.next_action_at ? (
              <p className={cn("text-[14px]", overdue ? "font-semibold text-sales-warning-fg" : "text-sales-text-primary")}>
                {overdue ? "Overdue · " : "Due "}
                {formatWhen(String(opp.next_action_at))}
              </p>
            ) : (
              <ReEmptyState compact title="No next step is scheduled" description="Recording a contact can set the next time to get in touch. It also marks the owner as contacted." />
            )}
          </ReSection>

          <InspectionForm
            clientId={clientId}
            opp={opp}
            bundle={bundle}
            busy={busy}
            uploading={uploading}
            setUploading={setUploading}
            setError={setError}
            act={act}
            onPreview={setPhotoPreview}
          />

          <PricingForm
            prices={bundle.prices}
            latestPrice={latestPrice}
            priceType={priceType}
            setPriceType={setPriceType}
            busy={busy}
            clientId={clientId}
            setError={setError}
            act={act}
          />

          <MandateForm busy={busy} clientId={clientId} setError={setError} act={act} />

          {bundle.mandates.map((mandate) => (
            <ReSection
              key={String(mandate.id)}
              id={`mandate-${String(mandate.id)}`}
              title={mandateTypeLabel(mandate.mandate_type as string)}
              action={<ReStatusBadge label={mandateStatusLabel(String(mandate.displayStatus ?? mandate.status))} tone={mandateTone(String(mandate.displayStatus ?? mandate.status))} />}
            >
              <p className="text-[13px] text-sales-text-secondary">
                Evidence {String(mandate.evidence_status ?? "not provided").replaceAll("_", " ")}
                {mandate.start_date ? ` · from ${String(mandate.start_date)}` : ""}
                {mandate.expiry_date ? ` · expires ${String(mandate.expiry_date)}` : ""}
                {mandate.previous_mandate_id ? " · renewal of an earlier mandate" : ""}
              </p>
              <div className="mt-3">
                <MandateActions
                  clientId={clientId}
                  mandate={{ ...mandate, id: String(mandate.id), status: String(mandate.status) }}
                  canReview={canReview}
                  onChanged={() => void load()}
                />
              </div>
            </ReSection>
          ))}

          <ListingBlock
            status={String(opp.status)}
            listingHref={listingHref}
            canReview={canReview}
            hasValidMandate={evidence.hasValidMandate}
            decisionOk={listingDecision.ok}
            decisionError={listingDecision.ok ? null : listingDecision.error}
            busy={busy}
            onPrepare={() => void act({ action: "prepare_listing", managerOverride: canReview })}
          />

          <ReSection id="acq-history" title="Activity" flush>
            {bundle.events.length === 0 ? (
              <ReEmptyState compact title="No activity recorded yet" />
            ) : (
              <ol className="divide-y divide-sales-border-subtle">
                {bundle.events.map((item) => (
                  <li key={String(item.id)} className="px-[var(--re-card-pad,16px)] py-2.5 text-[13px]">
                    <span className="font-medium text-sales-text-primary">{String(item.event_type).replaceAll("_", " ")}</span>
                    {item.to_value ? <span className="text-sales-text-secondary"> · {String(item.to_value)}</span> : null}
                    <span className="block text-[12px] text-sales-text-muted">{formatWhen(String(item.created_at))}</span>
                  </li>
                ))}
              </ol>
            )}
          </ReSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-[var(--re-section-gap,16px)] layout:col-span-4">
          <ReSection id="acq-summary" title="Opportunity">
            <ReDetailList
              items={[
                { label: "Stage", value: stageLabel(stageName) },
                { label: "Status", value: String(opp.status).replaceAll("_", " ") },
                { label: "Intent", value: intentLabel(String(opp.property_intent)) },
                { label: "Reference", value: opp.reference_number ? String(opp.reference_number) : null },
                { label: "Owner", value: ownerName },
              ]}
            />
          </ReSection>
          <ReSection id="acq-missing" title="Still missing">
            {missing.length ? (
              <ul className="space-y-1.5 text-[13px] text-sales-text-secondary">
                {missing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="text-[13px] text-sales-text-secondary">Phone, location, a completed inspection and an in-date mandate are all recorded.</p>
            )}
          </ReSection>
        </aside>
      </div>

      {stageOpen ? (
        <ReSheet title="Change stage" description={title} placement="bottom" onClose={() => setStageOpen(false)}>
          <ul className="space-y-1">
            {choices.map((choice) => (
              <li key={choice.stage}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStageOpen(false);
                    void act({ action: "stage", stage: choice.stage });
                  }}
                  className="re-focus flex min-h-12 w-full flex-col items-start rounded-[10px] px-3 py-2 text-left hover:bg-sales-surface-hover disabled:opacity-50"
                >
                  <span className="text-[14px] font-semibold text-sales-text-primary">
                    {choice.label}
                    {choice.stage === opp.stage ? " · current" : ""}
                    {choice.blocked ? " · needs evidence" : ""}
                  </span>
                  {choice.reason ? <span className="text-[12px] leading-snug text-sales-text-muted">{choice.reason}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </ReSheet>
      ) : null}

      {contactOpen ? (
        <ReSheet
          title="Record owner contact"
          description="This marks the owner as contacted and can set the next step."
          placement="bottom"
          onClose={() => setContactOpen(false)}
          footer={<button type="submit" form="record-contact" disabled={busy} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>Save contact</button>}
        >
          <form
            id="record-contact"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setContactOpen(false);
              void act({
                action: "contact",
                note: String(form.get("note") ?? "") || "Owner contacted",
                nextActionAt: form.get("nextActionAt") || null,
                interested: form.get("interested") === "on",
              });
            }}
          >
            <Field label="What was said" name="contact-note"><textarea id="contact-note" name="note" className={acqFieldClass} rows={3} /></Field>
            <Field label="Next step" name="contact-next"><input id="contact-next" name="nextActionAt" type="datetime-local" className={acqFieldClass} /></Field>
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-sales-text-secondary">
              <input name="interested" type="checkbox" className="size-4" /> Owner is interested
            </label>
          </form>
        </ReSheet>
      ) : null}

      {lostOpen ? (
        <ReSheet
          title="Mark opportunity lost"
          description={title}
          placement="bottom"
          onClose={() => setLostOpen(false)}
          footer={<button type="submit" form="mark-lost" disabled={busy} className="re-focus min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-danger px-4 text-[14px] font-semibold text-sales-danger-fg">Mark lost</button>}
        >
          <form
            id="mark-lost"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
              if (!reason) return;
              setLostOpen(false);
              void act({ action: "outcome", status: "lost", reason });
            }}
          >
            <Field label="Reason" name="lost-reason"><textarea id="lost-reason" name="reason" required minLength={3} className={acqFieldClass} rows={3} /></Field>
          </form>
        </ReSheet>
      ) : null}

      {photoPreview ? (
        <ReSheet title={photoPreview.caption} onClose={() => setPhotoPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview.src} alt={photoPreview.caption} className="max-h-[70vh] w-full object-contain" />
        </ReSheet>
      ) : null}
    </div>
  );
}

function Field({ label, name, children, className }: { label: string; name: string; children: ReactNode; className?: string }) {
  return (
    <label className={className} htmlFor={name}>
      <span className={acqLabelClass}>{label}</span>
      {children}
    </label>
  );
}

function OwnerBlock({
  ownerName,
  phone,
  email,
  ownersPath,
  contactId,
}: {
  ownerName: string;
  phone: string | null;
  email: string | null;
  ownersPath: string;
  contactId: string | null;
}) {
  return (
    <ReSection id="acq-owner" title="Owner" action={contactId ? <Link href={`${ownersPath}?contactId=${contactId}`} className="re-focus text-[13px] font-semibold underline-offset-2 hover:underline">Owner record</Link> : undefined}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sales-surface-subtle text-sales-text-secondary" aria-hidden>
          <UserRound size={16} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-sales-text-primary">{ownerName}</p>
          {phone ? <p className="text-[13px] text-sales-text-secondary">{phone}</p> : <p className="text-[13px] text-sales-text-muted">No phone yet</p>}
          {email ? <p className="text-[13px] text-sales-text-muted">{email}</p> : null}
        </div>
      </div>
      {phone ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${phone}`} className="re-focus inline-flex min-h-11 items-center gap-1.5 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold">
            <Phone size={14} strokeWidth={1.8} aria-hidden /> Call
          </a>
          <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold">
            WhatsApp
          </a>
        </div>
      ) : null}
    </ReSection>
  );
}

function InspectionForm({
  clientId,
  opp,
  bundle,
  busy,
  uploading,
  setUploading,
  setError,
  act,
  onPreview,
}: {
  clientId: string;
  opp: Record<string, unknown>;
  bundle: Bundle;
  busy: boolean;
  uploading: boolean;
  setUploading: (value: boolean) => void;
  setError: (value: string | null) => void;
  act: (body: Record<string, unknown>) => Promise<unknown>;
  onPreview: (value: { src: string; caption: string }) => void;
}) {
  return (
    <form
      id="acq-inspection"
      className="scroll-mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void act({
          action: "inspection",
          inspection: {
            status: form.get("status"),
            scheduled_at: form.get("scheduled_at") || null,
            property_type: form.get("property_type") || null,
            ...(form.get("property_category") ? { property_category: form.get("property_category") } : {}),
            address: form.get("address") || null,
            suburb: form.get("suburb") || null,
            city: form.get("city") || null,
            bedrooms: form.get("bedrooms") ? Number(form.get("bedrooms")) : null,
            bathrooms: form.get("bathrooms") ? Number(form.get("bathrooms")) : null,
            notes: form.get("notes") || null,
            utilities: { water: form.get("water") || null, electricity: form.get("electricity") || null },
            condition: { general: form.get("condition") || null },
            documentation: { title_deeds: form.get("title") || "not_provided" },
          },
        });
      }}
    >
      <ReSection id="acq-inspection-card" title="Inspection" description="Saving adds an inspection on this opportunity. It is not a buyer viewing.">
        <nav className="-mx-1 mb-3 flex gap-2 overflow-x-auto" aria-label="Inspection sections">
          {INSPECTION_JUMPS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="re-focus inline-flex min-h-11 shrink-0 items-center rounded-full border border-sales-border px-3 text-[13px] font-semibold text-sales-text-secondary">
              {label}
            </a>
          ))}
        </nav>
        <div className="grid gap-4">
          <div id="inspect-place" className="scroll-mt-24 grid gap-3 sm:grid-cols-2">
            <p className="text-[13px] font-semibold sm:col-span-2">Property</p>
            <Field label="Status" name="status">
              <select id="status" name="status" className={acqFieldClass} defaultValue="scheduled">
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="incomplete">Incomplete</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Scheduled" name="scheduled_at"><input id="scheduled_at" name="scheduled_at" type="datetime-local" className={acqFieldClass} /></Field>
            <Field label="Suburb" name="suburb"><input id="suburb" name="suburb" className={acqFieldClass} defaultValue={(opp.suburb as string) ?? ""} /></Field>
            <Field label="City" name="city"><input id="city" name="city" className={acqFieldClass} /></Field>
            <Field label="Address" name="address" className="sm:col-span-2"><input id="address" name="address" className={acqFieldClass} /></Field>
          </div>
          <div id="inspect-features" className="scroll-mt-24 grid gap-3 sm:grid-cols-2">
            <p className="text-[13px] font-semibold sm:col-span-2">Characteristics</p>
            <Field label="Property type" name="property_category">
              <select id="property_category" name="property_category" className={acqFieldClass} defaultValue={(opp.property_category as string) ?? ""}>
                <option value="">Not set</option>
                {PROPERTY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{PROPERTY_CATEGORY_LABEL[category]}</option>
                ))}
              </select>
            </Field>
            <Field label="Other details" name="property_type"><input id="property_type" name="property_type" className={acqFieldClass} /></Field>
            <Field label="Bedrooms" name="bedrooms"><input id="bedrooms" name="bedrooms" type="number" inputMode="numeric" min="0" className={acqFieldClass} /></Field>
            <Field label="Bathrooms" name="bathrooms"><input id="bathrooms" name="bathrooms" type="number" inputMode="numeric" min="0" className={acqFieldClass} /></Field>
          </div>
          <div id="inspect-utilities" className="scroll-mt-24 grid gap-3 sm:grid-cols-2">
            <p className="text-[13px] font-semibold sm:col-span-2">Utilities</p>
            <Field label="Water supply" name="water"><input id="water" name="water" className={acqFieldClass} /></Field>
            <Field label="Electricity" name="electricity"><input id="electricity" name="electricity" className={acqFieldClass} /></Field>
          </div>
          <div id="inspect-condition" className="scroll-mt-24">
            <Field label="General condition" name="condition"><input id="condition" name="condition" className={acqFieldClass} /></Field>
          </div>
          <div id="inspect-docs" className="scroll-mt-24">
            <Field label="Title deeds" name="title">
              <select id="title" name="title" className={acqFieldClass} defaultValue="not_provided">
                <option value="not_provided">Not provided</option>
                <option value="reported">Reported by owner</option>
                <option value="provided">Provided</option>
                <option value="under_review">Under review</option>
              </select>
            </Field>
          </div>
          <div id="inspect-notes" className="scroll-mt-24">
            <Field label="Observations" name="notes"><textarea id="notes" name="notes" className={acqFieldClass} rows={4} /></Field>
          </div>
        </div>
        <button type="submit" disabled={busy} className="mt-3 min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[14px] font-semibold">
          {busy ? "Saving…" : "Save inspection"}
        </button>
        {bundle.inspections.length ? (
          <ul className="mt-3 divide-y divide-sales-border-subtle text-[13px]">
            {bundle.inspections.map((item) => (
              <li key={String(item.id)} className="flex items-center justify-between gap-2 py-2">
                <ReStatusBadge label={inspectionStatusLabel(String(item.status))} tone={inspectionTone(String(item.status))} />
                <span className="text-sales-text-muted">{item.scheduled_at ? formatWhen(String(item.scheduled_at)) : "No time"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-[13px] text-sales-text-muted">No inspection saved on this opportunity yet.</p>}

        <div id="inspect-photos" className="mt-4 scroll-mt-24 border-t border-sales-border-subtle pt-4">
          <h3 className="text-[14px] font-semibold">Property photos</h3>
          <p className="mt-1 text-[13px] text-sales-text-secondary">Add photographs taken during the inspection. A photo appears here only after it is stored.</p>
          {bundle.inspections[0] ? (
            <label className="mt-3 block text-[13px] font-medium text-sales-text-secondary">
              Take or upload a photo
              <input
                className="mt-1 block w-full text-[14px]"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={uploading || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const inspectionId = String(bundle.inspections[0]?.id ?? "");
                  event.target.value = "";
                  if (!file || !inspectionId || uploading) return;
                  setUploading(true);
                  setError(null);
                  void (async () => {
                    const presign = await fetch(`/api/clients/${clientId}/company-documents/presign`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ filename: file.name, contentType: file.type || "image/jpeg", sizeBytes: file.size, title: file.name }),
                    });
                    const json = await presign.json();
                    if (!presign.ok) {
                      setError(json.error ?? "Photo upload is not available");
                      setUploading(false);
                      return;
                    }
                    const put = await fetch(json.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/jpeg" }, body: file });
                    if (!put.ok) {
                      setError("The photo could not be stored.");
                      setUploading(false);
                      return;
                    }
                    await act({ action: "photo", inspectionId, documentId: json.documentId, caption: file.name });
                    setUploading(false);
                  })();
                }}
              />
            </label>
          ) : <p className="mt-2 text-[13px] text-sales-text-muted">Save an inspection before adding photos. Photos attach to the latest inspection.</p>}
          {uploading ? <p className="mt-2 text-[13px]" role="status">Uploading photo…</p> : null}
          {bundle.photos.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {bundle.photos.map((photo) => {
                const caption = String(photo.caption || "Inspection photo");
                const docId = photo.document_id ? String(photo.document_id) : null;
                const src = docId ? `/api/clients/${clientId}/company-documents/${docId}/download` : null;
                return (
                  <li key={String(photo.id)} className="min-w-0">
                    {src ? (
                      <button type="button" className="re-focus block w-full overflow-hidden rounded-[10px] border border-sales-border-subtle" onClick={() => onPreview({ src, caption })}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={caption} className="aspect-[4/3] w-full object-cover" />
                      </button>
                    ) : (
                      <p className="rounded-[10px] border border-sales-border-subtle px-2 py-3 text-[12px]">{caption}</p>
                    )}
                    <p className="mt-1 truncate text-[12px] text-sales-text-muted">{caption}</p>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-2 text-[13px] text-sales-text-muted">No photos stored yet.</p>}
        </div>
      </ReSection>
    </form>
  );
}

function PricingForm({
  prices,
  latestPrice,
  priceType,
  setPriceType,
  busy,
  clientId,
  setError,
  act,
}: {
  prices: Array<Record<string, unknown>>;
  latestPrice: Record<string, unknown> | undefined;
  priceType: string;
  setPriceType: (value: string) => void;
  busy: boolean;
  clientId: string;
  setError: (value: string | null) => void;
  act: (body: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>;
}) {
  return (
    <form
      id="acq-pricing"
      className="scroll-mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formEl = event.currentTarget;
        const form = new FormData(formEl);
        void (async () => {
          const file = form.get("evidence");
          let documentId: string | null = null;
          if (file instanceof File && file.size > 0) {
            const uploaded = await uploadEvidence(clientId, file);
            if (!uploaded.ok) {
              setError(uploaded.error);
              return;
            }
            documentId = uploaded.documentId;
          }
          const json = await act({
            action: "price",
            amount: Number(form.get("amount")),
            priceType: form.get("priceType"),
            note: form.get("note") || null,
            currency: "USD",
            documentId,
            verificationReference: String(form.get("verificationReference") ?? "").trim() || null,
          });
          if (json && !json.error) formEl.reset();
        })();
      }}
    >
      <ReSection id="acq-pricing-card" title="Pricing and valuation" description="Track owner expectations, pricing discussions and supporting valuations.">
        {latestPrice ? (
          <p className="mb-3 text-[15px] font-semibold tabular-nums">
            {priceTypeLabel(String(latestPrice.price_type))} · {String(latestPrice.currency)} {String(latestPrice.amount)}
          </p>
        ) : <p className="mb-3 text-[13px] text-sales-text-muted">No price recorded yet.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Amount" name="amount"><input id="amount" name="amount" type="number" inputMode="decimal" step="0.01" min="0" required className={acqFieldClass} /></Field>
          <Field label="Price type" name="priceType">
            <select id="priceType" name="priceType" className={acqFieldClass} value={priceType} onChange={(event) => setPriceType(event.target.value)}>
              {PRICE_TYPES.map((type) => <option key={type} value={type}>{priceTypeLabel(type)}</option>)}
            </select>
          </Field>
          <Field label="Note" name="note"><input id="note" name="note" className={acqFieldClass} /></Field>
        </div>
        {priceType === "professional_valuation" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Valuation report" name="price-evidence"><input id="price-evidence" name="evidence" type="file" accept=".pdf,image/*" className="block w-full text-[14px]" /></Field>
            <Field label="Or valuer reference" name="verificationReference"><input id="verificationReference" name="verificationReference" className={acqFieldClass} /></Field>
            <p className="text-[12px] text-sales-text-muted sm:col-span-2">A professional valuation needs the report or a reference that can be checked. The server decides who may record one.</p>
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="mt-3 min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[14px] font-semibold">Record price</button>
        <ol className="mt-3 space-y-2">
          {prices.map((price) => (
            <li key={String(price.id)} className="border-t border-sales-border-subtle pt-2 text-[13px]">
              <span className="font-medium">{priceTypeLabel(String(price.price_type))}</span>
              <span className="mt-0.5 block text-sales-text-secondary">
                {String(price.currency)} {String(price.amount)} · {formatWhen(String(price.recorded_at))}
                {price.note ? ` · ${String(price.note)}` : ""}
              </span>
              {price.price_type === "professional_valuation" ? (
                <span className="block text-[12px] text-sales-text-muted">
                  {price.document_id || price.verification_reference
                    ? `Evidence ${price.verification_reference ? String(price.verification_reference) : "attached"}. An attachment is not a verified valuation.`
                    : "No evidence recorded."}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </ReSection>
    </form>
  );
}

function MandateForm({
  busy,
  clientId,
  setError,
  act,
}: {
  busy: boolean;
  clientId: string;
  setError: (value: string | null) => void;
  act: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <form
      id="acq-mandate"
      className="scroll-mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void (async () => {
          const file = form.get("evidence");
          let documentId: string | null = null;
          if (file instanceof File && file.size > 0) {
            const uploaded = await uploadEvidence(clientId, file);
            if (!uploaded.ok) {
              setError(uploaded.error);
              return;
            }
            documentId = uploaded.documentId;
          }
          await act({
            action: "mandate",
            mandateType: form.get("mandateType"),
            startDate: form.get("startDate") || null,
            expiryDate: form.get("expiryDate") || null,
            documentId,
            submit: form.get("submit") === "on",
          });
        })();
      }}
    >
      <ReSection id="acq-mandate-card" title="Mandate" description="Marketing authority for this property. Uploading a file does not approve it.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type" name="mandateType">
            <select id="mandateType" name="mandateType" className={acqFieldClass} defaultValue="sole">
              <option value="sole">Sole</option>
              <option value="joint">Joint</option>
              <option value="open">Open</option>
            </select>
          </Field>
          <Field label="Start" name="startDate"><input id="startDate" name="startDate" type="date" className={acqFieldClass} /></Field>
          <Field label="Expiry" name="expiryDate"><input id="expiryDate" name="expiryDate" type="date" className={acqFieldClass} /></Field>
        </div>
        <Field label="Signed mandate" name="mandate-evidence" className="mt-3">
          <input id="mandate-evidence" name="evidence" type="file" accept=".pdf,image/*" className="block w-full text-[14px]" />
        </Field>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-[13px] text-sales-text-secondary">
          <input name="submit" type="checkbox" className="size-4" /> Submit for manager review
        </label>
        <button type="submit" disabled={busy} className="mt-2 min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[14px] font-semibold">Save mandate</button>
      </ReSection>
    </form>
  );
}

function ListingBlock({
  status,
  listingHref,
  canReview,
  hasValidMandate,
  decisionOk,
  decisionError,
  busy,
  onPrepare,
}: {
  status: string;
  listingHref: string | null;
  canReview: boolean;
  hasValidMandate: boolean;
  decisionOk: boolean;
  decisionError: string | null;
  busy: boolean;
  onPrepare: () => void;
}) {
  return (
    <ReSection id="acq-listing" title="Listing preparation" className="scroll-mt-4">
      {status === "converted" && listingHref ? (
        <>
          <p className="text-[14px] font-semibold">Listing approved</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">This opportunity was converted when the listing was approved. Whether buyers can see it still depends on the listing itself.</p>
          <Link href={listingHref} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 inline-flex min-h-11")}>Open listing</Link>
        </>
      ) : listingHref ? (
        <>
          <p className="text-[14px] font-medium">A listing draft already exists.</p>
          <Link href={listingHref} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "mt-3 inline-flex min-h-11")}>Open listing draft</Link>
        </>
      ) : decisionOk ? (
        <>
          <p className="text-[13px] text-sales-text-secondary">
            {canReview && !hasValidMandate
              ? "You can prepare a draft without an approved mandate. That exception is recorded."
              : "Preparing a listing creates one draft. It stays off buyer matching until a manager approves it."}
          </p>
          <button type="button" disabled={busy} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 min-h-11")} onClick={onPrepare}>
            Prepare listing
          </button>
        </>
      ) : (
        <ReEmptyState compact title="Listing preparation is blocked" description={decisionError ?? undefined} />
      )}
    </ReSection>
  );
}
