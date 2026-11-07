"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContextCompliancePanel } from "@/components/real-estate/compliance/ContextCompliancePanel";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import { ReEmptyState, ReErrorState, RePageHeader, ReSection, ReSkeletonRows, ReStatusBadge } from "@/components/real-estate/ui";

type Owner = {
  contactId: string;
  name: string | null;
  kind?: "individual" | "company" | "unknown";
  representatives?: string[];
};

type Opportunity = {
  id: string;
  contact_id: string | null;
  owner_name: string | null;
  owner_phone?: string | null;
  address?: string | null;
  suburb: string | null;
  city: string | null;
  property_intent: string;
  status: string;
  converted_listing_id?: string | null;
};

type IntakeRequest = {
  id: string;
  status: string;
  kind: string | null;
  templateTitle: string | null;
  contactId: string | null;
  opportunityId: string | null;
};

type IntakeField = { key: string; label: string; value: string | null };

type OfferRow = {
  id: string;
  buyerName: string | null;
  currentAmountLabel: string;
  statusLabel: string;
  propertyLabel: string;
};

const HIDDEN = "Submitted for a permitted reviewer";

function shown(value: string | null | undefined): string {
  const text = value?.trim() ?? "";
  if (!text || text === HIDDEN) return "";
  return text;
}

function fieldValue(fields: IntakeField[], key: string): string {
  return shown(fields.find((field) => field.key === key)?.value);
}

function money(value: string): string {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  if (!value.trim() || !Number.isFinite(amount)) return value;
  return amount.toLocaleString();
}

function place(row: Opportunity, fields: IntakeField[]): string {
  return fieldValue(fields, "propertyAddress") || [row.address, row.suburb, row.city].filter(Boolean).join(", ") || "Property address not recorded";
}

export function SellerProfile({
  clientId,
  ownerId,
  basePath,
  framed = false,
}: {
  clientId: string;
  ownerId: string;
  basePath: string;
  framed?: boolean;
}) {
  const rootClass = framed ? reEmbeddedShell : reSalesShell;
  const listingsPath = basePath.replace(/\/owners$/, "/listings");
  const offersPath = basePath.replace(/\/owners$/, "/offers");
  const mandatesPath = basePath.replace(/\/owners$/, "/mandates");
  const inspectionsPath = basePath.replace(/\/owners$/, "/acquisitions");
  const [owner, setOwner] = useState<Owner | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const ownersRes = await fetch(`/api/clients/${clientId}/owners?contactId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
      const ownersJson = await ownersRes.json().catch(() => ({}));
      if (!ownersRes.ok) {
        if (!cancelled) {
          setError(ownersJson.error ?? "Could not open this seller.");
          setLoading(false);
        }
        return;
      }
      const rows = (ownersJson.opportunities ?? []) as Opportunity[];
      const found = ((ownersJson.owners ?? []) as Owner[])[0] ?? null;
      const contactId = rows.find((row) => row.contact_id)?.contact_id ?? (found && !found.contactId.startsWith("unlinked:") && !found.contactId.startsWith("company:") ? found.contactId : "");
      const opportunityId = rows[0]?.id ?? ownerId;
      const [byContact, byOpportunity] = await Promise.all([
        contactId ? fetch(`/api/clients/${clientId}/seller-intakes?contactId=${encodeURIComponent(contactId)}`, { cache: "no-store" }) : Promise.resolve(null),
        fetch(`/api/clients/${clientId}/seller-intakes?opportunityId=${encodeURIComponent(opportunityId)}`, { cache: "no-store" }),
      ]);
      const contactJson = byContact ? await byContact.json().catch(() => ({})) : {};
      const opportunityJson = await byOpportunity.json().catch(() => ({}));
      const requests = [...(contactJson.requests ?? []), ...(opportunityJson.requests ?? [])] as IntakeRequest[];
      const intake = requests.find((row) => row.id) ?? null;
      let intakeFields: IntakeField[] = [];
      if (intake) {
        const detailRes = await fetch(`/api/clients/${clientId}/seller-intakes/${intake.id}`, { cache: "no-store" });
        const detailJson = await detailRes.json().catch(() => ({}));
        if (detailRes.ok) intakeFields = detailJson.fields ?? [];
      }
      const listingId = rows.find((row) => row.converted_listing_id)?.converted_listing_id ?? "";
      let offerRows: OfferRow[] = [];
      if (listingId) {
        const offerRes = await fetch(`/api/clients/${clientId}/offers?listing_id=${encodeURIComponent(listingId)}&tab=all`, { cache: "no-store" });
        const offerJson = await offerRes.json().catch(() => ({}));
        if (offerRes.ok) offerRows = offerJson.offers ?? [];
      }
      if (cancelled) return;
      setOwner(found);
      setOpportunities(rows);
      setRequest(intake);
      setFields(intakeFields);
      setOffers(offerRows);
      setError(found ? null : "This seller was not found.");
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, ownerId]);

  if (loading) return <div className={rootClass}><ReSkeletonRows rows={5} label="Loading this seller" /></div>;
  if (!owner) {
    return (
      <div className={rootClass}>
        <ReErrorState title="This seller didn't open" description={error ?? "Try again from Sellers."} />
      </div>
    );
  }

  const property = opportunities[0] ?? null;
  const listingId = opportunities.find((row) => row.converted_listing_id)?.converted_listing_id ?? "";
  const phone = shown(property?.owner_phone) || fieldValue(fields, "cell") || fieldValue(fields, "representativePhone");
  const address = property ? place(property, fields) : fieldValue(fields, "propertyAddress");
  const companyName = fieldValue(fields, "companyName") || (owner.kind === "company" ? owner.name ?? "" : "");
  const representative = fieldValue(fields, "representativeName") || owner.representatives?.[0] || "";
  const asking = fieldValue(fields, "askingPrice");
  const mandatePrice = fieldValue(fields, "mandatePrice");
  const openOffers = offers.filter((row) => !["Rejected", "Withdrawn", "Expired"].includes(row.statusLabel));
  const finishHref = listingId ? `${listingsPath}/${listingId}` : property ? `${inspectionsPath}/${property.id}#acq-inspection` : listingsPath;
  const primaryHref = openOffers.length ? offersPath : finishHref;
  const primaryLabel = openOffers.length ? "Review offer" : "Finish the listing";
  const contactId = property?.contact_id && !String(property.contact_id).startsWith("unlinked:") ? property.contact_id : owner.contactId.startsWith("unlinked:") || owner.contactId.startsWith("company:") ? "" : owner.contactId;

  return (
    <div className={rootClass}>
      <RePageHeader
        context={<Link href={basePath} className="re-focus rounded text-sales-text-secondary hover:text-sales-text-primary">Sellers</Link>}
        title={owner.name || fieldValue(fields, "registeredOwner") || "Seller"}
        description={address || "A completed mandate opens this seller and the property they are listing."}
        actions={
          <div className="flex flex-wrap gap-2">
            {request ? (
              <a href={`/api/clients/${clientId}/seller-intakes/${request.id}/record`} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11 sm:h-10")}>
                Download PDF
              </a>
            ) : null}
            <Link href={primaryHref} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:h-10")}>
              {primaryLabel}
            </Link>
          </div>
        }
      />
      <div className="grid min-w-0 gap-4 layout:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <ReSection
            id="property"
            title="Property"
            description="Taken from the mandate form. It stays incomplete until the inspection, the photos, and the remaining details are added."
            action={<ReStatusBadge label={listingId ? "Draft listing" : "Incomplete"} tone="warning" />}
          >
            {address ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <Fact label="Address" value={address} />
                <Fact label="Type" value={fieldValue(fields, "propertyCategory") || "Not recorded"} />
                <Fact label="Ownership" value={fieldValue(fields, "propertyRights") || "Not recorded"} />
                <Fact label="Occupied by" value={fieldValue(fields, "occupation") || "Not recorded"} />
                <Fact label="Asking price" value={asking ? money(asking) : "Not recorded"} />
              </dl>
            ) : (
              <p className="text-[14px] text-sales-text-secondary">The property from the mandate is not on this seller yet.</p>
            )}
            {opportunities.length > 1 ? (
              <ul className="mt-4 divide-y divide-sales-border-subtle">
                {opportunities.slice(1).map((row) => (
                  <li key={row.id} className="py-2">
                    <Link href={`${basePath}/${row.id}`} className="re-focus text-[14px] font-semibold">{place(row, [])}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </ReSection>

          <ReSection id="mandate" title="Mandate" description="The form this seller completed. The PDF lists every answer, under the agency name and logo." action={<Link href={mandatesPath} className="re-focus min-h-11 text-[13px] font-semibold">Mandates</Link>}>
            {request ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Fact label="Form" value={request.kind === "sole" ? "Sole mandate" : request.kind === "open" ? "Open mandate" : request.templateTitle || "Mandate form"} />
                  <Fact label="Status" value={request.status.replaceAll("_", " ")} />
                  <Fact label="Starts" value={fieldValue(fields, "mandateStartDate") || "Not set"} />
                  <Fact label="Ends" value={fieldValue(fields, "mandateEndDate") || "Not set"} />
                  <Fact label="Mandate price" value={mandatePrice ? money(mandatePrice) : "Not recorded"} />
                </dl>
                <a href={`/api/clients/${clientId}/seller-intakes/${request.id}/record`} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "mt-4 inline-flex min-h-11")}>
                  Download PDF
                </a>
              </>
            ) : (
              <ReEmptyState compact title="No mandate on this seller yet" description="Send the seller form from Mandates. Accepting the completed form keeps it here." />
            )}
          </ReSection>

          <ReSection id="offers" title="Offers" description="Offer letters for this house, for the seller to review.">
            {offers.length === 0 ? (
              <ReEmptyState compact title="No offer letters yet" description="After a viewing, the buyer's offer letter comes back to this seller." />
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {offers.map((offer) => (
                  <li key={offer.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                    <span className="text-[14px] font-semibold">{offer.buyerName || "Buyer"} · {offer.currentAmountLabel}</span>
                    <ReStatusBadge label={offer.statusLabel} />
                  </li>
                ))}
              </ul>
            )}
            {offers.length ? <Link href={offersPath} className="re-focus mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold">Review offer</Link> : null}
          </ReSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <ReSection id="seller" title="Seller">
            <p className="text-[16px] font-semibold [overflow-wrap:anywhere]">{owner.name || "Seller"}</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{owner.kind === "company" ? "Company" : "Individual"}</p>
            {phone ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="re-focus inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" href={`tel:${phone}`}>Call</a>
                <a className="re-focus inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
              </div>
            ) : <p className="mt-2 text-[12px] text-sales-text-muted">No phone on this seller yet.</p>}
            {companyName || representative ? (
              <dl className="mt-4 grid gap-3">
                {companyName ? <Fact label="Company" value={companyName} /> : null}
                {representative ? <Fact label="Completed the form" value={representative} /> : null}
              </dl>
            ) : null}
          </ReSection>
          {contactId ? <ContextCompliancePanel clientId={clientId} context="seller" title="Seller verification" contactId={contactId} /> : null}
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-sales-text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium text-sales-text-primary [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
