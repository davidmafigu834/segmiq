"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useState } from "react";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import Link from "next/link";
import { ContextCompliancePanel } from "@/components/real-estate/compliance/ContextCompliancePanel";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABEL,
  REJECTION_REASONS,
  REJECTION_LABEL,
  asPropertyCategories,
  type PropertyCategory,
  type RejectionReason,
} from "@/lib/real-estate/buyer-match";
import { Button, salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import {
  ReActionMenu,
  ReDetailList,
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";

type Bundle = {
  search: Record<string, unknown>;
  contact: { id: string; name: string | null; phone: string | null } | null;
  interests: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  viewings: Array<Record<string, unknown>>;
  offers: Array<Record<string, unknown>>;
  applications: Array<Record<string, unknown>>;
  roles: Array<{ role: string }>;
};

type ListingBits = {
  suburb?: string | null;
  address?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  transaction_type?: string;
  property_category?: string | null;
  status?: string | null;
  photos?: unknown;
};

type Match = {
  listingId: string;
  strength: string;
  score?: number;
  reasons: string[];
  listing: ListingBits | null;
};

type Panel =
  | { kind: "requirements" }
  | { kind: "recommend"; listingId: string }
  | { kind: "reject"; listingId: string }
  | { kind: "match"; listingId: string };

const INTEREST_LABEL: Record<string, string> = {
  matched: "Matched",
  recommended: "Recommended",
  sent: "Sent",
  interested: "Interested",
  not_interested: "Not interested",
  viewing_requested: "Viewing requested",
  viewing_completed: "Viewing completed",
  offer: "Offer",
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

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function photo(listing: ListingBits | null): string | null {
  const photos = listing?.photos;
  if (!Array.isArray(photos) || typeof photos[0] !== "string") return null;
  return photos[0];
}

function strengthLabel(strength: string): string {
  if (strength === "strong") return "Strong match";
  if (strength === "alternative") return "Alternative";
  if (strength === "partial") return "Partial match";
  return "Match";
}

function place(listing: ListingBits | null): string {
  return [listing?.address, listing?.suburb].filter(Boolean).join(", ") || "Property";
}

function asking(listing: ListingBits | null): string {
  if (listing?.price == null || !Number.isFinite(Number(listing.price))) return "Price not recorded";
  return Number(listing.price).toLocaleString();
}

function dealKind(type: string | undefined): string {
  if (type === "rental") return "To rent";
  if (type === "new_development") return "New development";
  if (type === "sale") return "For sale";
  return type ? type : "";
}

function moneyRange(search: Record<string, unknown>): string {
  const currency = text(search.currency);
  const prefix = currency ? `${currency} ` : "";
  const min = search.budget_min;
  const max = search.budget_max;
  if (min == null && max == null) return "Budget not set";
  if (min != null && max != null) return `${prefix}${min}–${max}`;
  if (max != null) return `Up to ${prefix}${max}`;
  return `From ${prefix}${min}`;
}

export function BuyerSearchDetail({
  clientId,
  searchId,
  offersHref,
  framed = false,
}: {
  clientId: string;
  searchId: string;
  offersHref: string;
  canVerifyDeposit?: boolean;
  framed?: boolean;
}) {
  const rootClass = framed ? reEmbeddedShell : shell;
  const buyersPath = offersHref.replace(/\/offers$/, "/buyers");
  const listingsPath = offersHref.replace(/\/offers$/, "/listings");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [more, setMore] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason | "">("");
  const [rejectNote, setRejectNote] = useState("");
  const [requirements, setRequirements] = useState({
    budgetMax: "",
    locations: "",
    bedrooms: "",
    bathrooms: "",
    timeframe: "",
    notes: "",
    leaseMonths: "",
    moveInDate: "",
    above: false,
    categories: [] as PropertyCategory[],
  });

  async function load() {
    setLoading(true);
    const [bundleRes, matchRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/buyer-searches/${searchId}`),
      fetch(`/api/clients/${clientId}/matching?searchId=${searchId}`),
    ]);
    const bundleJson = await bundleRes.json().catch(() => ({}));
    const matchJson = await matchRes.json().catch(() => ({}));
    if (!bundleRes.ok) {
      setError(bundleJson.error ?? "Could not open this search");
      setLoading(false);
      return;
    }
    setError(null);
    setBundle(bundleJson);
    setMatches(matchRes.ok ? matchJson.matches ?? [] : []);
    setMatchNotice(matchRes.ok ? matchJson.notice ?? null : matchJson.error ?? "Matches could not be loaded.");
    const search = bundleJson.search as Record<string, unknown>;
    setRequirements({
      budgetMax: search.budget_max == null ? "" : String(search.budget_max),
      locations: Array.isArray(search.locations) ? (search.locations as string[]).join(", ") : "",
      bedrooms: search.bedrooms == null ? "" : String(search.bedrooms),
      bathrooms: search.bathrooms == null ? "" : String(search.bathrooms),
      timeframe: text(search.timeframe),
      notes: text(search.other_requirements),
      leaseMonths: search.lease_months == null ? "" : String(search.lease_months),
      moveInDate: text(search.move_in_date).slice(0, 10),
      above: Boolean(search.allow_above_budget),
      categories: asPropertyCategories(search.property_categories),
    });
    setLoading(false);
  }

  async function patchSearch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-searches/${searchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save the search.");
      return false;
    }
    setPanel(null);
    await load();
    return true;
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save");
      return false;
    }
    setPanel(null);
    await load();
    return true;
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, searchId]);

  if (loading && !bundle) return <div className={rootClass}><ReSkeletonRows rows={5} label="Loading this buyer" /></div>;
  if (!bundle) {
    return (
      <div className={rootClass}>
        <ReErrorState title="This buyer didn't open" description={error ?? "Try again."} onRetry={() => void load()} />
      </div>
    );
  }

  const search = bundle.search;
  const phone = bundle.contact?.phone;
  const rental = search.intent === "rental";
  const categories = asPropertyCategories(search.property_categories);
  const categoryLabel = categories.map((category) => PROPERTY_CATEGORY_LABEL[category]).join(", ");
  const locations = Array.isArray(search.locations) ? (search.locations as string[]).filter(Boolean) : [];
  const interestByListing = new Map(bundle.interests.map((row) => [String(row.listing_id), row]));
  const linkedViewing = bundle.viewings.find((row) => row.listing_id) ?? null;
  const linkedListingId = text(linkedViewing?.listing_id);
  const linkedMatch = matches.find((row) => row.listingId === linkedListingId) ?? null;
  const linkedLabel = text(linkedViewing?.property_label) || (linkedMatch ? place(linkedMatch.listing) : "");
  const offerParams = new URLSearchParams();
  if (linkedListingId) offerParams.set("listingId", linkedListingId);
  if (bundle.contact?.id) offerParams.set("contactId", bundle.contact.id);
  const offerQuery = offerParams.toString();
  const offerHref = offerQuery ? `${offersHref}?${offerQuery}` : offersHref;
  const activeMatch = panel && "listingId" in panel ? matches.find((row) => row.listingId === panel.listingId) ?? null : null;

  return (
    <div className={rootClass}>
      <RePageHeader
        context={<Link href={buyersPath} className="re-focus rounded text-sales-text-secondary hover:text-sales-text-primary">Buyers & tenants</Link>}
        title={bundle.contact?.name ?? (rental ? "Tenant" : "Buyer")}
        description={linkedLabel ? `${rental ? "Tenant" : "Buyer"} · ${linkedLabel}` : `${rental ? "Tenant" : "Buyer"} profile. A signed viewing form links them to a property.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={offerHref} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:h-10")}>Generate offer letter</Link>
            <a href="#recommendations" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11 sm:h-10")}>Property recommendation</a>
            <ReActionMenu
              label="More actions for this buyer"
              sheetTitle="Buyer actions"
              actions={[
                { id: "edit", label: "Edit what they are looking for", onSelect: () => setPanel({ kind: "requirements" }) },
              ]}
            />
          </div>
        }
      />

      {error && !panel ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {phone ? (
        <div className="flex flex-wrap gap-2 layout:hidden">
          <a className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold" href={`tel:${phone}`}>Call</a>
          <a className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 layout:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.85fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 layout:order-1">
          <ReSection
            id="property"
            className="order-1"
            title="Property"
            description="The house this buyer asked to view. The offer letter is written against this property and its seller."
            action={linkedListingId ? <Link href={`${listingsPath}/${linkedListingId}`} className="re-focus min-h-11 text-[13px] font-semibold">Open property</Link> : undefined}
          >
            {linkedLabel ? (
              <div>
                <p className="text-[16px] font-semibold [overflow-wrap:anywhere]">{linkedLabel}</p>
                <p className="mt-1 text-[13px] text-sales-text-secondary">
                  {linkedViewing?.scheduled_at ? `Viewing ${new Date(String(linkedViewing.scheduled_at)).toLocaleString()}` : "Viewing time not recorded"}
                  {linkedViewing?.outcome ? ` · ${OUTCOME_LABEL[String(linkedViewing.outcome)] ?? String(linkedViewing.outcome)}` : ""}
                </p>
              </div>
            ) : (
              <p className="text-[14px] text-sales-text-secondary">No property is linked yet. A signed viewing form puts the house and the appointment on this profile.</p>
            )}
          </ReSection>
          <ReSection id="requirements" className="order-4" title="Looking for" description="These details feed property recommendation." action={<button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setPanel({ kind: "requirements" })}>Edit</button>}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact label={rental ? "Renting" : "Buying"} value={categoryLabel || text(search.property_type) || "Property type open"} />
              <Fact label="Location" value={locations.join(", ") || "Location open"} />
              <Fact label={rental ? "Monthly budget" : "Budget"} value={moneyRange(search)} />
              <Fact label="Bedrooms" value={search.bedrooms != null ? `${search.bedrooms} or more` : "Not set"} />
            </dl>
            <button type="button" className="re-focus mt-3 min-h-11 text-[13px] font-semibold" aria-expanded={more} onClick={() => setMore((value) => !value)}>
              {more ? "Hide additional requirements" : "Additional search requirements"}
            </button>
            {more ? (
              <div className="mt-2">
                <ReDetailList
                  items={[
                    { label: "Bathrooms", value: search.bathrooms != null ? String(search.bathrooms) : "" },
                    { label: "Timeframe", value: text(search.timeframe) },
                    { label: "Move-in", value: text(search.move_in_date).slice(0, 10) },
                    { label: "Lease", value: search.lease_months != null ? `${search.lease_months} months` : "" },
                    { label: "Features", value: text(search.features) },
                    { label: "Notes", value: text(search.other_requirements) },
                    { label: "Above budget", value: search.allow_above_budget ? "May consider a higher price" : "" },
                  ]}
                />
              </div>
            ) : null}
          </ReSection>

          <ReSection id="recommendations" className="order-6" title="Property recommendation" count={matches.length} description="Properties that fit what this buyer is looking for. Recommending one records it on this profile.">
            {matchNotice ? <p className="mb-3 rounded-[8px] border border-sales-warning/30 bg-sales-warning-soft px-3 py-2 text-[12px] text-sales-warning-fg">{matchNotice}</p> : null}
            {matches.length === 0 ? (
              <ReEmptyState
                title="No suitable properties found"
                description="Try reviewing the search requirements or checking available listings."
                action={<Link href={listingsPath} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Open listings</Link>}
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {matches.map((match) => {
                  const interest = interestByListing.get(match.listingId);
                  const image = photo(match.listing);
                  return (
                    <li key={match.listingId} className="min-w-0 overflow-hidden rounded-[12px] border border-sales-border-subtle bg-sales-surface">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-sales-surface-subtle text-[12px] text-sales-text-muted">No photograph</div>
                      )}
                      <div className="space-y-1.5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-[14px] font-semibold leading-snug [overflow-wrap:anywhere]">{place(match.listing)}</p>
                          <ReStatusBadge label={strengthLabel(match.strength)} />
                        </div>
                        <p className="text-[13px] text-sales-text-secondary">
                          {asking(match.listing)}
                          {dealKind(match.listing?.transaction_type) ? ` · ${dealKind(match.listing?.transaction_type)}` : ""}
                          {match.listing?.bedrooms != null ? ` · ${match.listing.bedrooms} bed` : ""}
                          {match.listing?.bathrooms != null ? ` · ${match.listing.bathrooms} bath` : ""}
                        </p>
                        {typeof match.score === "number" ? <p className="text-[12px] text-sales-text-muted">Match score {match.score}</p> : null}
                        {match.reasons[0] ? <p className="text-[13px] leading-snug text-sales-text-secondary">{match.reasons[0]}</p> : null}
                        {interest ? <p className="text-[12px] font-medium">Interest: {INTEREST_LABEL[String(interest.interest_state)] ?? String(interest.interest_state)}</p> : null}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            className={cn(salesMenuTriggerClass({ variant: interest ? "secondary" : "primary", size: "sm" }), "min-h-11")}
                            onClick={() => setPanel(interest ? { kind: "match", listingId: match.listingId } : { kind: "recommend", listingId: match.listingId })}
                          >
                            {interest ? "View match" : "Recommend property"}
                          </button>
                          <ReActionMenu
                            label={`Actions for ${place(match.listing)}`}
                            sheetTitle={place(match.listing)}
                            actions={[
                              { id: "details", label: "View match explanation", onSelect: () => setPanel({ kind: "match", listingId: match.listingId }) },
                              { id: "property", label: "View property", onSelect: () => { window.location.href = `${listingsPath}/${match.listingId}`; } },
                              { id: "yes", label: "Mark interested", onSelect: () => void act({ action: "interest", searchId, listingId: match.listingId, state: "interested" }) },
                              { id: "no", label: "Mark not interested", onSelect: () => { setRejectReason(""); setPanel({ kind: "reject", listingId: match.listingId }); } },
                            ]}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ReSection>

          <ReSection
            id="viewings"
            className="order-2"
            title="Viewing"
            count={bundle.viewings.length}
            description="The date and time from the signed viewing form."
            action={<Link href={offersHref.replace(/\/offers$/, "/viewings")} className="re-focus min-h-11 text-[13px] font-semibold">Viewings</Link>}
          >
            {bundle.viewings.length === 0 ? <ReEmptyState compact title="No viewing yet" description="A signed viewing form books the visit on this buyer and on the calendar." /> : (
              <ul className="space-y-2">
                {bundle.viewings.map((viewing) => (
                  <li key={String(viewing.id)} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                    <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">{text(viewing.property_label) || "Property"}</p>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                      {viewing.scheduled_at ? new Date(String(viewing.scheduled_at)).toLocaleString() : "Time not recorded"}
                      {viewing.outcome ? ` · ${OUTCOME_LABEL[String(viewing.outcome)] ?? String(viewing.outcome)}` : ""}
                    </p>
                    {viewing.outcome === "wants_offer" ? <Link href={offerHref} className="re-focus mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold">Generate offer letter</Link> : null}
                  </li>
                ))}
              </ul>
            )}
          </ReSection>

          <ReSection id="offers" className="order-3" title="Offer letter" description="After the viewing, generate the letter. The buyer fills it, then the seller reviews it.">
            {bundle.offers.length === 0 ? <ReEmptyState compact title="No offer letter yet" description="Generate it for this buyer and the property they viewed." action={<Link href={offerHref} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Generate offer letter</Link>} /> : (
              <ul className="space-y-2 text-[14px]">
                {bundle.offers.map((offer) => (
                  <li key={String(offer.id)} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                    <Link href={`${offersHref}?offerId=${String(offer.id)}`} className="re-focus font-semibold tabular-nums underline-offset-2 hover:underline [overflow-wrap:anywhere]">{text(offer.currency) || "Amount"} {text(offer.current_offer_amount)}</Link>
                    <ReStatusBadge label={text(offer.status).replaceAll("_", " ") || "Draft"} />
                  </li>
                ))}
              </ul>
            )}
          </ReSection>

          {bundle.contact?.id ? (
            <div className="order-8">
              <ContextCompliancePanel clientId={clientId} context="buyer" title="Buyer verification" contactId={bundle.contact.id} />
            </div>
          ) : null}

        </div>

        <aside className="order-1 flex min-w-0 flex-col gap-4 layout:order-2">
          <ReSection id="customer" title="Customer">
            <p className="text-[16px] font-semibold [overflow-wrap:anywhere]">{bundle.contact?.name ?? "Customer"}</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{rental ? "Tenant" : "Buyer"}{bundle.roles.length ? ` · Also recorded as ${bundle.roles.map((role) => role.role).join(", ")}` : ""}</p>
            {phone ? (
              <div className="mt-3 hidden flex-wrap gap-2 layout:flex">
                <a className="re-focus inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" href={`tel:${phone}`}>Call</a>
                <a className="re-focus inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
              </div>
            ) : <p className="mt-2 text-[12px] text-sales-text-muted">No phone is available on this record.</p>}
          </ReSection>

        </aside>
      </div>

      {panel?.kind === "requirements" ? (
        <ReSheet
          title="What they are looking for"
          onClose={() => setPanel(null)}
          footer={<div className="flex flex-col gap-2"><div className="flex justify-end">{error ? <p className="mr-auto self-center text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}<Button form="edit-requirements" variant="primary" size="md" type="submit" loading={busy}>{busy ? "Saving…" : "Save requirements"}</Button></div></div>}
        >
          <form
            id="edit-requirements"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const saved = asPropertyCategories(search.property_categories);
              const categoriesChanged = requirements.categories.length !== saved.length || requirements.categories.some((item) => !saved.includes(item));
              void patchSearch({
                budgetMax: requirements.budgetMax ? Number(requirements.budgetMax) : null,
                locations: requirements.locations.split(",").map((item) => item.trim()).filter(Boolean),
                bedrooms: requirements.bedrooms ? Number(requirements.bedrooms) : null,
                bathrooms: requirements.bathrooms ? Number(requirements.bathrooms) : null,
                timeframe: requirements.timeframe || null,
                notes: requirements.notes || null,
                allowAboveBudget: requirements.above,
                ...(rental ? { leaseMonths: requirements.leaseMonths ? Number(requirements.leaseMonths) : null, moveInDate: requirements.moveInDate || null } : {}),
                ...(categoriesChanged ? { propertyCategories: requirements.categories } : {}),
              });
            }}
          >
            <fieldset>
              <legend className={acqLabelClass}>Property types</legend>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_CATEGORIES.map((category) => {
                  const on = requirements.categories.includes(category);
                  return (
                    <button key={category} type="button" aria-pressed={on} className={cn("re-focus min-h-11 rounded-full border px-3 text-[13px] font-semibold", on ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border")} onClick={() => setRequirements((current) => ({ ...current, categories: on ? current.categories.filter((item) => item !== category) : [...current.categories, category] }))}>
                      {PROPERTY_CATEGORY_LABEL[category]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className={acqLabelClass} htmlFor="req-budget">{rental ? "Monthly budget" : "Maximum budget"}</label>
            <input id="req-budget" className={acqFieldClass} inputMode="decimal" value={requirements.budgetMax} onChange={(event) => setRequirements({ ...requirements, budgetMax: event.target.value })} />
            <label className={acqLabelClass} htmlFor="req-places">Locations, separated by commas</label>
            <input id="req-places" className={acqFieldClass} value={requirements.locations} onChange={(event) => setRequirements({ ...requirements, locations: event.target.value })} />
            <label className={acqLabelClass} htmlFor="req-beds">Bedrooms</label>
            <input id="req-beds" className={acqFieldClass} inputMode="numeric" value={requirements.bedrooms} onChange={(event) => setRequirements({ ...requirements, bedrooms: event.target.value })} />
            <label className={acqLabelClass} htmlFor="req-baths">Bathrooms</label>
            <input id="req-baths" className={acqFieldClass} inputMode="numeric" value={requirements.bathrooms} onChange={(event) => setRequirements({ ...requirements, bathrooms: event.target.value })} />
            <label className={acqLabelClass} htmlFor="req-time">Timeframe</label>
            <input id="req-time" className={acqFieldClass} value={requirements.timeframe} onChange={(event) => setRequirements({ ...requirements, timeframe: event.target.value })} />
            {rental ? (
              <>
                <label className={acqLabelClass} htmlFor="req-move">Move-in date</label>
                <input id="req-move" type="date" className={acqFieldClass} value={requirements.moveInDate} onChange={(event) => setRequirements({ ...requirements, moveInDate: event.target.value })} />
                <label className={acqLabelClass} htmlFor="req-lease">Lease length in months</label>
                <input id="req-lease" className={acqFieldClass} inputMode="numeric" value={requirements.leaseMonths} onChange={(event) => setRequirements({ ...requirements, leaseMonths: event.target.value })} />
              </>
            ) : null}
            <label className={acqLabelClass} htmlFor="req-notes">Notes</label>
            <textarea id="req-notes" className={cn(acqFieldClass, "min-h-24 py-2")} value={requirements.notes} onChange={(event) => setRequirements({ ...requirements, notes: event.target.value })} />
            <label className="flex min-h-11 items-center gap-2 text-[13px]"><input type="checkbox" checked={requirements.above} onChange={(event) => setRequirements({ ...requirements, above: event.target.checked })} /> May consider above the stated maximum</label>
          </form>
        </ReSheet>
      ) : null}

      {panel?.kind === "recommend" && activeMatch ? (
        <ReSheet title="Recommend this property" description="This records a recommendation on the search. It does not send a WhatsApp message." onClose={() => setPanel(null)} footer={
          <div className="flex flex-col items-end gap-2">
            {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
            <button type="button" className="re-focus min-h-11 px-3 text-[14px] font-semibold" onClick={() => setPanel(null)}>Cancel</button>
            <Button type="button" variant="primary" size="md" loading={busy} onClick={() => void act({ action: "interest", searchId, listingId: activeMatch.listingId, state: "recommended" })}>{busy ? "Saving…" : "Record recommendation"}</Button>
            </div>
          </div>
        }>
          <p className="text-[15px] font-semibold">{place(activeMatch.listing)}</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">{bundle.contact?.name ?? "Customer"} · {rental ? "Renting" : "Buying"}</p>
          <p className="mt-2 text-[13px]">{strengthLabel(activeMatch.strength)}. {activeMatch.reasons.join(" ")}</p>
        </ReSheet>
      ) : null}

      {panel?.kind === "match" && activeMatch ? (
        <ReSheet title={place(activeMatch.listing)} description={`${asking(activeMatch.listing)}${dealKind(activeMatch.listing?.transaction_type) ? ` · ${dealKind(activeMatch.listing?.transaction_type)}` : ""}`} onClose={() => setPanel(null)}>
          {photo(activeMatch.listing) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo(activeMatch.listing)!} alt="" className="mb-3 aspect-[4/3] w-full rounded-[10px] object-cover" />
          ) : <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-[10px] bg-sales-surface-subtle text-[13px] text-sales-text-muted">No photograph</div>}
          <h3 className="text-[13px] font-semibold">Why it matches</h3>
          <ul className="mt-1 space-y-1 text-[13px] text-sales-text-secondary">
            {activeMatch.reasons.length ? activeMatch.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>The matcher did not return an explanation.</li>}
          </ul>
          {typeof activeMatch.score === "number" ? <p className="mt-2 text-[12px] text-sales-text-muted">Match score {activeMatch.score}. This is not a chance of closing.</p> : null}
          <p className="mt-3 text-[13px]">Interest: {INTEREST_LABEL[String(interestByListing.get(activeMatch.listingId)?.interest_state ?? "")] || "Not recorded"}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} onClick={() => setPanel({ kind: "recommend", listingId: activeMatch.listingId })}>Recommend property</button>
            <button type="button" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")} disabled={busy} onClick={() => void act({ action: "interest", searchId, listingId: activeMatch.listingId, state: "interested" })}>Mark interested</button>
            <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => { setRejectReason(""); setPanel({ kind: "reject", listingId: activeMatch.listingId }); }}>Not interested</button>
            <Link href={`${listingsPath}/${activeMatch.listingId}`} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Open property</Link>
          </div>
        </ReSheet>
      ) : null}

      {panel?.kind === "reject" ? (
        <ReSheet title="Why isn't this property suitable?" description="This applies to this search only." onClose={() => setPanel(null)} footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="re-focus min-h-11 px-3 text-[14px] font-semibold" onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} disabled={busy || !rejectReason} onClick={() => void act({ action: "interest", searchId, listingId: panel.listingId, state: "not_interested", rejectionReason: rejectReason, ...(rejectReason === "other" && rejectNote.trim() ? { note: rejectNote.trim() } : {}) })}>Save feedback</button>
          </div>
        }>
          <ul className="space-y-1">
            {REJECTION_REASONS.map((reason) => (
              <li key={reason}>
                <label className="flex min-h-12 items-center gap-3 rounded-[10px] px-2 text-[14px]">
                  <input type="radio" name="reject" checked={rejectReason === reason} onChange={() => setRejectReason(reason)} />
                  {REJECTION_LABEL[reason]}
                </label>
              </li>
            ))}
          </ul>
          {rejectReason === "other" ? <input className={`${acqFieldClass} mt-2`} placeholder="Add a short note" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} /> : null}
        </ReSheet>
      ) : null}

    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-sales-text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium text-sales-text-primary [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
