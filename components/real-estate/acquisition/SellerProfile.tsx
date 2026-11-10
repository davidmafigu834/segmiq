"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { evaluateMandateCompliance } from "@/lib/real-estate/seller-intake/compliance-checks";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import { ReErrorState } from "@/components/real-estate/ui";

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
  sellerLetter?: string;
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

  if (loading) {
    return (
      <div className={rootClass} aria-hidden>
        <div className="space-y-2">
          <span className="re-bone block h-3 w-16 rounded-[4px]" />
          <span className="re-bone block h-8 w-56 rounded-[6px]" />
          <span className="re-bone block h-3 w-72 rounded-[4px]" />
        </div>
        <div className="re-bone mt-4 h-36 rounded-[12px]" />
        <div className="re-bone mt-4 h-28 rounded-[12px]" />
      </div>
    );
  }
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
  const asking = fieldValue(fields, "askingPrice");
  const mandatePrice = fieldValue(fields, "mandatePrice");
  const openOffers = offers.filter((row) => !["Rejected", "Withdrawn", "Expired"].includes(row.statusLabel));
  const finishHref = listingId ? `${listingsPath}/${listingId}` : property ? `${inspectionsPath}/${property.id}#acq-inspection` : listingsPath;
  const formAnswers: Record<string, string> = {};
  for (const field of fields) {
    if (field.value) formAnswers[field.key] = field.value;
  }
  const formCheck = request ? evaluateMandateCompliance(request.kind === "sole" ? "sole" : "open", formAnswers) : null;
  const sellerIsCompany = formAnswers.ownerKind === "Company" || owner.kind === "company";
  const name = owner.name || fieldValue(fields, "registeredOwner") || "Seller";
  const kindLabel = sellerIsCompany ? "Company" : "Individual";
  const required = [
    ...(formCheck?.notOnForm ?? []),
    ...(formCheck?.missing.map((item) => item.label) ?? []),
  ];
  const start = fieldValue(fields, "mandateStartDate");
  const end = fieldValue(fields, "mandateEndDate");
  const mandateMeta = request ? (request.status === "complete" || request.status === "approved" ? "Accepted" : request.status.replaceAll("_", " ")) : "None";
  const mandateLine = [start && end ? `${start} – ${end}` : start || end, mandatePrice ? priceLabel(mandatePrice) : ""].filter(Boolean).join(" · ");
  const formHref = request ? `/api/clients/${clientId}/seller-intakes/${request.id}/record` : mandatesPath;
  const digits = phone.replace(/\D/g, "");

  return (
    <div className={`${rootClass} space-y-5`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">
            <Link href={basePath} className="re-focus rounded">Sellers</Link>
          </p>
          <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">{name}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{address || "Property address not recorded"}</p>
          <p className="mt-1 text-[13px] text-sales-text-muted">{kindLabel}{phone ? ` · ${phone}` : ""}</p>
        </div>
        {phone ? (
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${phone}`} className="re-focus inline-flex h-11 items-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover">
              <Phone size={16} strokeWidth={1.75} aria-hidden />
              Call
            </a>
            {digits ? (
              <a href={`https://wa.me/${digits}`} className="re-focus inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover">
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
      </header>

      <DiligenceScan sellerName={name} required={required} hasForm={Boolean(formCheck)} formHref={formHref} />

      <div className="grid items-start gap-4 layout:grid-cols-2">
        <Record title="Property" meta={listingId ? "Listing open" : "In preparation"}>
          <p className="px-4 pb-3 text-[13px] text-sales-text-secondary">
            {listingId ? "The listing is open. Photos and the remaining details are added there." : "Inspection, photos, and the remaining details are still to add."}
          </p>
          {address ? (
            <Facts
              rows={[
                ["Address", address],
                ["Type", fieldValue(fields, "propertyCategory") || "Not recorded"],
                ["Ownership", fieldValue(fields, "propertyRights") || "Not recorded"],
                ["Occupied by", fieldValue(fields, "occupation") || "Not recorded"],
                ["Asking price", asking ? priceLabel(asking) : "Not recorded"],
              ]}
            />
          ) : (
            <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-secondary">The property from the mandate is not on this seller yet.</p>
          )}
          {listingId ? (
            <div className="border-t border-sales-border-subtle px-4 py-3">
              <Link href={finishHref} className="re-focus inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold">Open property</Link>
            </div>
          ) : null}
          {opportunities.length > 1 ? (
            <ul className="border-t border-sales-border-subtle">
              {opportunities.slice(1).map((row) => (
                <li key={row.id} className="px-4 py-2">
                  <Link href={row.converted_listing_id ? `${listingsPath}/${row.converted_listing_id}` : `${inspectionsPath}/${row.id}#acq-inspection`} className="re-focus text-[14px] font-semibold">{place(row, [])}</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Record>
        <div className="space-y-4">
          <Record title="Mandate" meta={mandateMeta}>
            <div className="flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-sales-text-primary">{request ? (request.kind === "sole" ? "Sole mandate" : request.kind === "open" ? "Open mandate" : request.templateTitle || "Mandate") : "No mandate yet"}</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">{request ? mandateLine || "Dates are not on the form yet." : "Send the seller form from Mandates."}</p>
              </div>
              <a href={formHref} className="re-focus inline-flex h-11 shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover min-[480px]:h-9">
                {request ? "Open the form" : "Mandates"}
              </a>
            </div>
          </Record>
          <Record title="Offers" meta={String(openOffers.length || offers.length)}>
            {offers.length === 0 ? (
              <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-secondary">No offer on this house yet.</p>
            ) : (
              <ul>
                {offers.map((offer) => {
                  const unsent = (offer.sellerLetter ?? "").toLowerCase().includes("not been sent");
                  return (
                    <li key={offer.id} className="flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-sales-text-primary">{offer.buyerName || "Buyer"}</p>
                        <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{offer.currentAmountLabel} · {offer.sellerLetter || offer.statusLabel}</p>
                      </div>
                      <Link href={`${offersPath}?offerId=${offer.id}`} className="re-focus inline-flex h-11 shrink-0 items-center rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface transition-opacity hover:opacity-90 min-[480px]:h-9">
                        {unsent ? "Send letter" : "Open offer"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Record>
        </div>
      </div>
    </div>
  );
}

function DiligenceScan({
  sellerName,
  required,
  hasForm,
  formHref,
}: {
  sellerName: string;
  required: string[];
  hasForm: boolean;
  formHref: string;
}) {
  const [phase, setPhase] = useState<"scanning" | "required">("scanning");
  const [prepared, setPrepared] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      setPhase("required");
      return;
    }
    const timer = window.setTimeout(() => setPhase("required"), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const scanning = phase === "scanning";
  const count = required.length;

  return (
    <section className="dd overflow-hidden rounded-[16px] bg-[#101828] text-[#f7f9fc]" aria-live="polite">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#d4ff4f]">Due diligence</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold tracking-[-0.03em]">
            {scanning ? "Scanning" : hasForm ? (count ? "Still required" : "Nothing else required") : "No form yet"}
          </h2>
        </div>
        {scanning ? (
          <p className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em]">
            <span className="dd-live h-1.5 w-1.5 rounded-full bg-[#d4ff4f]" aria-hidden />
            Reading the form
          </p>
        ) : (
          <p className="dd-dim text-[13px]">{hasForm ? `${count} ${count === 1 ? "check" : "checks"}` : "Waiting"}</p>
        )}
      </div>
      {scanning ? (
        <div className="dd-plate dd-line mx-4 mb-4 h-40 rounded-[12px] border" aria-hidden>
          <span className="dd-corner left-2 top-2 border-l-2 border-t-2" />
          <span className="dd-corner right-2 top-2 border-r-2 border-t-2" />
          <span className="dd-corner bottom-2 left-2 border-b-2 border-l-2" />
          <span className="dd-corner bottom-2 right-2 border-b-2 border-r-2" />
          <div className="dd-beam" />
          <div className="space-y-3 px-4 py-4">
            <span className="dd-bar block w-4/5" />
            <span className="dd-bar block w-3/5" />
            <span className="dd-bar block w-2/3" />
            <span className="dd-bar block w-1/2" />
          </div>
        </div>
      ) : (
        <div className="dd-in">
          <p className="dd-dim px-4 pb-3 text-[13px]">
            {hasForm
              ? count
                ? "The form has been read. These were not collected."
                : "The form has been read. Nothing else is still required."
              : "A completed seller form has not been opened for this person yet."}
          </p>
          {count ? (
            <ul>
              {required.map((item) => (
                <li key={item} className="dd-line flex items-start justify-between gap-3 border-t px-4 py-3">
                  <span className="min-w-0 flex-1 text-[14px] font-semibold">{item}</span>
                  <span className="text-[13px] font-medium text-[#ff5d73]">Not collected</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="dd-line border-t px-4 py-4">
            {prepared ? (
              <div>
                <p className="text-[13px] font-medium text-[#d4ff4f]">Form prepared</p>
                <p className="mt-1 text-[13px] text-[#f7f9fc]">It asks only for what is still missing for {sellerName}.</p>
                <a href={formHref} className="re-focus mt-3 inline-flex h-11 items-center rounded-[10px] border border-[#f7f9fc]/30 px-4 text-[14px] font-semibold">
                  {hasForm ? "Open the form" : "Open mandates"}
                </a>
              </div>
            ) : (
              <button type="button" onClick={() => setPrepared(true)} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#d4ff4f] px-4 text-[14px] font-semibold text-[#101828]">
                Prepare a form
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Record({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">{title}</h2>
        <span className="text-[13px] text-sales-text-muted">{meta}</span>
      </div>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] text-sales-text-muted">{label}</dt>
          <dd className="text-[14px] font-medium text-sales-text-primary [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function priceLabel(value: string): string {
  const amount = money(value);
  if (!amount || amount === value) return value;
  return value.trim().startsWith("US$") || value.includes("$") ? value : `US$${amount}`;
}

