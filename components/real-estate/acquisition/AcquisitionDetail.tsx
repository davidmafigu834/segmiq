"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PROPERTY_CATEGORIES, PROPERTY_CATEGORY_LABEL } from "@/lib/real-estate/buyer-match";
import { Button, salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import {
  ReErrorState,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import {
  acqFieldClass,
  acqLabelClass,
  formatWhen,
  inspectionStatusLabel,
  inspectionTone,
  placeLabel,
} from "./acquisition-ui";

type Bundle = {
  opportunity: Record<string, unknown>;
  contact: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  events: Array<Record<string, unknown>>;
  inspections: Array<Record<string, unknown>>;
  photos: Array<Record<string, unknown>>;
  prices: Array<Record<string, unknown>>;
  mandates: Array<Record<string, unknown>>;
  parties?: Array<{ role: string; party_kind: string; display_name: string; contact_id: string | null }>;
};

const shellClass = reSalesShell;

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
  framed = false,
}: {
  clientId: string;
  opportunityId: string;
  basePath: string;
  ownersPath: string;
  canReview?: boolean;
  framed?: boolean;
}) {
  const rootClass = framed ? reEmbeddedShell : shellClass;
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      const listingRoot = basePath.includes("/sales") ? "/sales/listings" : "/client/listings";
      window.location.href = `${listingRoot}/${json.listingId}`;
      return json;
    }
    await load();
    return json;
  }

  if (!bundle && !error) {
    return (
      <div className={rootClass}>
        <ReSkeletonRows rows={6} label="Loading this inspection" />
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className={rootClass}>
        <ReErrorState title="This inspection didn't load" description={error ?? "Try again."} onRetry={() => void load()} />
      </div>
    );
  }

  const opp = bundle.opportunity;
  const title = placeLabel({
    suburb: opp.suburb as string | null,
    city: opp.city as string | null,
    address: opp.address as string | null,
  });
  const sellerName = (opp.owner_name as string) || bundle.contact?.name || "Seller";
  const sellerHref = `${ownersPath}/${bundle.contact?.id ?? opportunityId}`;
  const inspectionsPath = basePath.replace(/\/acquisitions$/, "/inspections");
  const listingsPath = basePath.replace(/\/acquisitions$/, "/listings");
  const listingId = (opp.converted_listing_id as string | null) ?? null;
  const listingHref = listingId ? `${listingsPath}/${listingId}` : null;
  const inspectionDone = bundle.inspections.some((row) => row.status === "completed");
  const photosMissing = bundle.photos.length === 0;
  const askingPrices = bundle.prices.filter((price) => price.price_type === "owner_asking");
  const missing = [
    inspectionDone ? null : "The inspection has not been completed.",
    photosMissing ? "No inspection photos yet." : null,
  ].filter((item): item is string => Boolean(item));
  const readiness = !inspectionDone ? "Inspection needed" : photosMissing ? "Photos needed" : "Ready for the listing";

  return (
    <div className={rootClass}>
      <div>
        <Link href={inspectionsPath} className="re-focus inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-sales-text-secondary">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
          Inspections
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-sales-text-primary [overflow-wrap:anywhere] layout:text-[28px]">
              {title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ReStatusBadge label={readiness} tone={missing.length ? "warning" : "success"} />
              <Link href={sellerHref} className="re-focus text-[13px] font-semibold text-sales-text-secondary">{sellerName}</Link>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href={sellerHref} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open seller</Link>
            {listingHref ? <Link href={listingHref} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>Open listing</Link> : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}

      <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] layout:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-[var(--re-section-gap,16px)] layout:col-span-8">
          <InspectionForm
            clientId={clientId}
            opp={opp}
            bundle={bundle}
            busy={busy}
            uploading={uploading}
            setUploading={setUploading}
            setError={setError}
            act={act}
            reload={load}
            onPreview={setPhotoPreview}
          />

          <PricingForm prices={askingPrices} busy={busy} act={act} />
        </div>

        <aside className="flex min-w-0 flex-col gap-[var(--re-section-gap,16px)] layout:col-span-4">
          <ReSection id="acq-missing" title="Before the listing">
            {missing.length ? (
              <ul className="space-y-1.5 text-[13px] text-sales-text-secondary">
                {missing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="text-[13px] text-sales-text-secondary">The inspection is complete and the photos are stored. Finish the remaining details on the listing.</p>
            )}
            {listingHref ? <Link href={listingHref} className="re-focus mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold">Open listing</Link> : <p className="mt-3 text-[13px] text-sales-text-muted">The draft listing appears here after the mandate is approved.</p>}
          </ReSection>
        </aside>
      </div>

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

function InspectionForm({
  clientId,
  opp,
  bundle,
  busy,
  uploading,
  setUploading,
  setError,
  act,
  reload,
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
  reload: () => Promise<void>;
  onPreview: (value: { src: string; caption: string }) => void;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const opportunityId = String(opp.id ?? "");
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
      <ReSection id="acq-inspection-card" title="Inspection" description="Record what you saw on the visit, then add the photos. This is not a buyer viewing.">
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
            <Field label="City" name="city"><input id="city" name="city" className={acqFieldClass} defaultValue={(opp.city as string) ?? ""} /></Field>
            <Field label="Address" name="address" className="sm:col-span-2"><input id="address" name="address" className={acqFieldClass} defaultValue={(opp.address as string) ?? ""} /></Field>
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
        <Button type="submit" variant="secondary" size="md" className="mt-3" loading={busy}>{busy ? "Saving…" : "Save inspection"}</Button>
        {bundle.inspections.length ? (
          <ul className="mt-3 divide-y divide-sales-border-subtle text-[13px]">
            {bundle.inspections.map((item) => (
              <li key={String(item.id)} className="flex items-center justify-between gap-2 py-2">
                <ReStatusBadge label={inspectionStatusLabel(String(item.status))} tone={inspectionTone(String(item.status))} />
                <span className="text-sales-text-muted">{item.scheduled_at ? formatWhen(String(item.scheduled_at)) : "No time"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-[13px] text-sales-text-muted">No inspection saved yet.</p>}

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
                  const kind = `${file.type} ${file.name}`.toLowerCase();
                  if (kind.includes("heic") || kind.includes("heif")) {
                    setPhotoError("This phone saves HEIC photos. Choose a JPEG or PNG instead.");
                    return;
                  }
                  setUploading(true);
                  setPhotoError(null);
                  setError(null);
                  void (async () => {
                    const body = new FormData();
                    body.set("file", file);
                    body.set("inspectionId", inspectionId);
                    const res = await fetch(`/api/clients/${clientId}/acquisitions/${opportunityId}/photos`, { method: "POST", body });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setPhotoError(json.error ?? "The photo could not be stored.");
                      setUploading(false);
                      return;
                    }
                    await reload();
                    setUploading(false);
                  })();
                }}
              />
            </label>
          ) : <p className="mt-2 text-[13px] text-sales-text-muted">Save an inspection before adding photos. Photos attach to the latest inspection.</p>}
          {uploading ? <p className="mt-2 text-[13px]" role="status">Uploading photo…</p> : null}
          {photoError ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{photoError}</p> : null}
          {bundle.photos.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {bundle.photos.map((photo) => {
                const caption = String(photo.caption || "Inspection photo");
                const docId = photo.document_id ? String(photo.document_id) : null;
                const src = docId
                  ? `/api/clients/${clientId}/company-documents/${docId}/download`
                  : photo.storage_key
                    ? `/api/clients/${clientId}/acquisitions/${opportunityId}/photos/${photo.id}`
                    : null;
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
  busy,
  act,
}: {
  prices: Array<Record<string, unknown>>;
  busy: boolean;
  act: (body: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>;
}) {
  const latest = prices[0];
  return (
    <form
      id="acq-pricing"
      className="scroll-mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formEl = event.currentTarget;
        const form = new FormData(formEl);
        void (async () => {
          const json = await act({
            action: "price",
            amount: Number(form.get("amount")),
            priceType: "owner_asking",
            note: form.get("note") || "Revised after the inspection",
            currency: "USD",
          });
          if (json && !json.error) formEl.reset();
        })();
      }}
    >
      <ReSection id="acq-pricing-card" title="Price after the visit" description="Record a new asking price only when the inspection changes the price already on the seller.">
        {latest ? (
          <p className="mb-3 text-[15px] font-semibold tabular-nums">Current asking price · {String(latest.currency)} {String(latest.amount)}</p>
        ) : <p className="mb-3 text-[13px] text-sales-text-muted">No revised price from this visit yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Asking price" name="amount"><input id="amount" name="amount" type="number" inputMode="decimal" step="0.01" min="0" required className={acqFieldClass} /></Field>
          <Field label="Why it changed" name="note"><input id="note" name="note" className={acqFieldClass} /></Field>
        </div>
        <button type="submit" disabled={busy} className="mt-3 min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[14px] font-semibold">Save revised price</button>
        {prices.length > 1 ? (
          <ol className="mt-3 space-y-2">
            {prices.slice(1).map((price) => (
              <li key={String(price.id)} className="border-t border-sales-border-subtle pt-2 text-[13px] text-sales-text-secondary">
                {String(price.currency)} {String(price.amount)} · {formatWhen(String(price.recorded_at))}
                {price.note ? ` · ${String(price.note)}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
      </ReSection>
    </form>
  );
}
