"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABEL,
  REJECTION_REASONS,
  REJECTION_LABEL,
  SEARCH_STAGES,
  STAGE_LABEL,
  VIEWING_OUTCOMES,
  asPropertyCategories,
  type PropertyCategory,
  type RejectionReason,
  type SearchStage,
} from "@/lib/real-estate/buyer-match";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
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
import { acqFieldClass, acqLabelClass, formatWhen } from "@/components/real-estate/acquisition/acquisition-ui";

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

type Sibling = {
  id: string;
  intent: string;
  locations: string[] | null;
  budget_max: number | null;
  currency: string | null;
  bedrooms: number | null;
  property_type: string | null;
  pipeline_stage: string | null;
  status: string;
};

type Panel =
  | { kind: "stage" }
  | { kind: "requirements" }
  | { kind: "recommend"; listingId: string }
  | { kind: "reject"; listingId: string }
  | { kind: "match"; listingId: string }
  | { kind: "viewing" }
  | { kind: "outcome"; viewingId: string }
  | { kind: "reschedule"; viewingId: string }
  | { kind: "application" };

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

const OUTCOME_GROUPS: Array<{ title: string; values: string[] }> = [
  { title: "Positive interest", values: ["interested", "wants_offer"] },
  { title: "Needs more time", values: ["considering", "second_viewing"] },
  { title: "Not suitable", values: ["too_expensive", "location_unsuitable", "condition", "not_interested"] },
  { title: "Did not attend", values: ["no_show"] },
];

const APPLICATION_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  declined: "Declined",
};

const DEPOSIT_LABEL: Record<string, string> = {
  expected: "Deposit expected",
  reported: "Deposit reported",
  verified: "Deposit verified",
};

const shell =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:px-6 md:pb-6";

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
  canVerifyDeposit = false,
}: {
  clientId: string;
  searchId: string;
  offersHref: string;
  canVerifyDeposit?: boolean;
}) {
  const buyersPath = offersHref.replace(/\/offers$/, "/buyers");
  const listingsPath = offersHref.replace(/\/offers$/, "/listings");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [rejectReason, setRejectReason] = useState<RejectionReason | "">("");
  const [rejectNote, setRejectNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [savedOutcome, setSavedOutcome] = useState<string | null>(null);
  const [overlap, setOverlap] = useState<{ body: Record<string, unknown>; warning: string } | null>(null);
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
    const contactId = text(search.contact_id);
    if (contactId) {
      const siblingRes = await fetch(`/api/clients/${clientId}/buyer-searches?contactId=${contactId}`);
      const siblingJson = await siblingRes.json().catch(() => ({}));
      setSiblings(siblingRes.ok ? (siblingJson.searches ?? []).filter((row: Sibling) => row.id !== searchId) : []);
    }
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
      if (res.status === 409 && json.warning && (body.action === "viewing" || body.action === "reschedule_viewing") && !body.confirmOverlap) {
        setOverlap({ body, warning: String(json.warning) });
        return false;
      }
      setError(json.error ?? "Could not save");
      return false;
    }
    setOverlap(null);
    setPanel(null);
    if (body.action === "viewing_outcome") setSavedOutcome(String(body.outcome));
    await load();
    return true;
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, searchId]);

  if (loading && !bundle) return <div className={shell}><ReSkeletonRows rows={5} label="Loading this search" /></div>;
  if (!bundle) {
    return (
      <div className={shell}>
        <ReErrorState title="This search didn't open" description={error ?? "Try again."} onRetry={() => void load()} />
      </div>
    );
  }

  const search = bundle.search;
  const stage = ((search.pipeline_stage as SearchStage) || "actively_searching");
  const phone = bundle.contact?.phone;
  const rental = search.intent === "rental";
  const categories = asPropertyCategories(search.property_categories);
  const categoryLabel = categories.map((category) => PROPERTY_CATEGORY_LABEL[category]).join(", ");
  const locations = Array.isArray(search.locations) ? (search.locations as string[]).filter(Boolean) : [];
  const interestByListing = new Map(bundle.interests.map((row) => [String(row.listing_id), row]));
  const recommendedCount = bundle.interests.filter((row) => row.interest_state === "recommended" || row.interest_state === "sent").length;
  const completedViewings = bundle.viewings.filter((row) => row.status === "completed" || row.outcome).length;
  const openOffers = bundle.offers.filter((row) => !["rejected", "withdrawn", "expired"].includes(String(row.status)));
  const listingOptions = new Map<string, string>();
  for (const match of matches) listingOptions.set(match.listingId, `${place(match.listing)} · ${strengthLabel(match.strength)}`);
  for (const interest of bundle.interests) {
    const id = String(interest.listing_id ?? "");
    if (id && interest.interest_state !== "not_interested" && !listingOptions.has(id)) {
      listingOptions.set(id, `Recorded interest · ${INTEREST_LABEL[String(interest.interest_state)] ?? String(interest.interest_state)}`);
    }
  }
  const activeMatch = panel && "listingId" in panel ? matches.find((row) => row.listingId === panel.listingId) ?? null : null;

  return (
    <div className={shell}>
      <RePageHeader
        context={<Link href={buyersPath} className="re-focus rounded text-sales-text-secondary hover:text-sales-text-primary">Buyers & tenants</Link>}
        title={`${bundle.contact?.name ?? "Customer"} — property search`}
        description={`${rental ? "Renting" : "Buying"} · ${STAGE_LABEL[stage] ?? stage}${search.created_at && formatWhen(text(search.created_at)) ? ` · Opened ${formatWhen(text(search.created_at))}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href="#matches" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:h-10")}>Find matching properties</a>
            <ReActionMenu
              label="More actions for this search"
              sheetTitle="Search actions"
              actions={[
                { id: "edit", label: "Edit requirements", onSelect: () => setPanel({ kind: "requirements" }) },
                { id: "follow", label: "Add follow-up", onSelect: () => document.getElementById("next-action")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
                { id: "stage", label: "Change stage", onSelect: () => setPanel({ kind: "stage" }) },
                { id: "viewing", label: "Schedule viewing", onSelect: () => setPanel({ kind: "viewing" }) },
              ]}
            />
          </div>
        }
      />

      {error ? <ReErrorState title="Something didn't save" description={error} /> : null}
      {phone ? (
        <div className="flex flex-wrap gap-2 layout:hidden">
          <a className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold" href={`tel:${phone}`}>Call</a>
          <a className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 layout:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.85fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 layout:order-1">
          <ReSection id="requirements" title="Looking for" action={<button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setPanel({ kind: "requirements" })}>Edit requirements</button>}>
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

          {siblings.length ? (
            <ReSection id="other-searches" title="Other searches for this customer" count={siblings.length} description="These requirements stay separate from the search you are working on.">
              <ul className="space-y-2">
                {siblings.map((row) => (
                  <li key={row.id}>
                    <Link href={`${buyersPath}/${row.id}`} className="re-focus block rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                      <span className="block text-[14px] font-semibold">{row.intent === "rental" ? "Renting" : "Buying"}{row.property_type ? ` · ${row.property_type}` : ""}</span>
                      <span className="mt-0.5 block text-[12px] text-sales-text-secondary">
                        {(row.locations ?? []).filter(Boolean).join(", ") || "Location open"}
                        {row.budget_max != null ? ` · Up to ${row.currency ? `${row.currency} ` : ""}${row.budget_max}` : ""}
                        {" · "}
                        {STAGE_LABEL[(row.pipeline_stage as SearchStage) || "actively_searching"] ?? row.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ReSection>
          ) : null}

          <ReSection id="matches" title="Matching properties" count={matches.length} description="Explanations come from the matcher. A match score is not a chance of closing.">
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
                              { id: "property", label: "View property", onSelect: () => { window.location.href = listingsPath; } },
                              { id: "yes", label: "Mark interested", onSelect: () => void act({ action: "interest", searchId, listingId: match.listingId, state: "interested" }) },
                              { id: "no", label: "Mark not interested", onSelect: () => { setRejectReason(""); setPanel({ kind: "reject", listingId: match.listingId }); } },
                              { id: "view", label: "Schedule viewing", onSelect: () => setPanel({ kind: "viewing" }) },
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

          <ReSection id="considered" title="Properties considered" count={bundle.interests.length}>
            {bundle.interests.length === 0 ? <ReEmptyState compact title="Nothing recorded yet" description="Recommend a match or mark interest before this list fills in." /> : (
              <ul className="divide-y divide-sales-border-subtle">
                {bundle.interests.map((interest) => (
                  <li key={String(interest.id)} className="flex min-w-0 items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{INTEREST_LABEL[String(interest.interest_state)] ?? String(interest.interest_state || "Recorded")}</p>
                      <p className="text-[12px] text-sales-text-secondary [overflow-wrap:anywhere]">
                        {interest.interest_state === "not_interested"
                          ? REJECTION_LABEL[(interest.rejection_reason as RejectionReason) || "other"]
                          : "Still in play on this search"}
                        {interest.interest_state === "sent" ? "" : interest.interest_state === "recommended" ? " · Recorded here. This is not a sent message." : ""}
                      </p>
                    </div>
                    {interest.interest_state !== "not_interested" ? (
                      <button type="button" className="re-focus min-h-11 shrink-0 text-[13px] font-semibold" onClick={() => { setRejectReason(""); setPanel({ kind: "reject", listingId: String(interest.listing_id) }); }}>
                        Not interested
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ReSection>

          <ReSection
            id="viewings"
            title="Viewings"
            count={bundle.viewings.length}
            action={<button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setPanel({ kind: "viewing" })}>Schedule viewing</button>}
          >
            {bundle.viewings.length === 0 ? <ReEmptyState compact title="No viewings scheduled" description="Book one from a property this customer is considering." /> : (
              <ul className="space-y-2">
                {bundle.viewings.map((viewing) => (
                  <li key={String(viewing.id)} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                    <p className="text-[14px] font-semibold">{viewing.scheduled_at ? new Date(String(viewing.scheduled_at)).toLocaleString() : "Time not recorded"}</p>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                      Status {String(viewing.status || "scheduled")}
                      {viewing.confirmation_status ? ` · Confirmation ${String(viewing.confirmation_status).replaceAll("_", " ")}` : ""}
                    </p>
                    {viewing.outcome ? <p className="mt-1 text-[13px]">{OUTCOME_LABEL[String(viewing.outcome)] ?? String(viewing.outcome)}</p> : null}
                    {viewing.status === "scheduled" ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => { setOutcome(""); setPanel({ kind: "outcome", viewingId: String(viewing.id) }); }}>Record outcome</button>
                        <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setPanel({ kind: "reschedule", viewingId: String(viewing.id) })}>Reschedule</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {savedOutcome ? (
              <p className="mt-3 text-[13px] text-sales-text-secondary">
                Outcome saved as {OUTCOME_LABEL[savedOutcome] ?? savedOutcome}.
                {savedOutcome === "wants_offer" ? " Create the offer from Offers when you are ready. Nothing was created automatically." : ""}
                {savedOutcome === "second_viewing" ? " Book the next visit when you have a time." : ""}
              </p>
            ) : null}
          </ReSection>

          <ReSection id="offers" title={rental ? "Applications" : "Offers"} description={rental ? "An accepted application is not a completed tenancy." : "An accepted offer is not a completed sale."}>
            {bundle.offers.length === 0 && !rental ? <ReEmptyState compact title="No offers yet" description="Offers are prepared from the offers workspace." /> : null}
            <ul className="space-y-2 text-[14px]">
              {bundle.offers.map((offer) => (
                <li key={String(offer.id)} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold tabular-nums [overflow-wrap:anywhere]">{text(offer.currency) || "Amount"} {text(offer.current_offer_amount)}</span>
                  <ReStatusBadge label={text(offer.status).replaceAll("_", " ") || "Draft"} />
                </li>
              ))}
            </ul>
            <Link href={offersHref} className="re-focus mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold">Open offers</Link>
            {rental ? (
              <div className="mt-4 border-t border-sales-border-subtle pt-3">
                <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setPanel({ kind: "application" })}>Submit rental application</button>
                <ul className="mt-2 space-y-2">
                  {bundle.applications.map((row) => {
                    const deposit = String(row.deposit_status || "expected");
                    return (
                      <li key={String(row.id)} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <ReStatusBadge label={APPLICATION_LABEL[String(row.status)] ?? String(row.status)} tone={row.status === "declined" ? "danger" : row.status === "accepted" ? "success" : "neutral"} />
                          <ReStatusBadge label={DEPOSIT_LABEL[deposit] ?? deposit} tone={deposit === "verified" ? "success" : deposit === "reported" ? "warning" : "neutral"} />
                        </div>
                        <p className="mt-1 text-[12px] text-sales-text-secondary">A reported deposit is not verified cash. Accepting an application does not mark the property let.</p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {deposit === "expected" ? (
                            <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void act({ action: "deposit", applicationId: row.id, depositAction: "report" })}>Report deposit</button>
                          ) : null}
                          {canVerifyDeposit && deposit !== "verified" ? (
                            <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void act({ action: "deposit", applicationId: row.id, depositAction: "verify" })}>Mark deposit verified</button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </ReSection>

          <ReSection id="activity" title="Activity" count={bundle.events.length}>
            {bundle.events.length === 0 ? <ReEmptyState compact title="No activity yet" /> : (
              <ul className="space-y-2">
                {bundle.events.map((event) => (
                  <li key={String(event.id)} className="text-[13px] text-sales-text-secondary">
                    <span className="font-medium text-sales-text-primary">{text(event.event_type).replaceAll("_", " ")}</span>
                    {event.field_name ? ` · ${text(event.field_name).replaceAll("_", " ")}` : ""}
                    {event.to_value ? ` → ${text(event.to_value)}` : ""}
                    {event.created_at ? ` · ${formatWhen(text(event.created_at))}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </ReSection>
        </div>

        <aside className="order-1 flex min-w-0 flex-col gap-4 layout:order-2">
          <ReSection id="customer" title="Customer">
            <p className="text-[16px] font-semibold [overflow-wrap:anywhere]">{bundle.contact?.name ?? "Customer"}</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{rental ? "Tenant search" : "Buyer search"}{bundle.roles.length ? ` · Also recorded as ${bundle.roles.map((role) => role.role).join(", ")}` : ""}</p>
            {phone ? (
              <div className="mt-3 hidden flex-wrap gap-2 layout:flex">
                <a className="re-focus inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" href={`tel:${phone}`}>Call</a>
                <a className="re-focus inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
              </div>
            ) : <p className="mt-2 text-[12px] text-sales-text-muted">No phone is available on this record.</p>}
          </ReSection>

          <ReSection id="next-action" title="Next action">
            <p className="text-[14px]">{text(search.next_action_note) || "No next action recorded."}</p>
            {search.next_action_at ? <p className="mt-1 text-[12px] text-sales-text-muted">{formatWhen(text(search.next_action_at))}</p> : null}
            <form
              className="mt-3 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void patchSearch({ nextActionNote: note, nextActionAt: when ? new Date(when).toISOString() : null });
              }}
            >
              <label className={acqLabelClass} htmlFor="follow-note">What should happen next</label>
              <input id="follow-note" className={acqFieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
              <label className={acqLabelClass} htmlFor="follow-when">When</label>
              <input id="follow-when" className={acqFieldClass} type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
              <button className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")} type="submit" disabled={busy}>Add follow-up</button>
            </form>
          </ReSection>

          <ReSection id="stage" title="Search progress" action={<button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setPanel({ kind: "stage" })}>Change stage</button>}>
            <p className="text-[12px] text-sales-text-muted">Current stage</p>
            <p className="mt-1 text-[16px] font-semibold">{STAGE_LABEL[stage] ?? stage}</p>
            <p className="mt-2 text-[12px] text-sales-text-secondary">Changing stage does not book a viewing, create an offer, or close another search.</p>
          </ReSection>

          <ReSection id="summary" title="Activity summary">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Count label="Recommended" value={recommendedCount} />
              <Count label="Viewings done" value={completedViewings} />
              <Count label="Open offers" value={openOffers.length} />
            </dl>
          </ReSection>
        </aside>
      </div>

      {panel?.kind === "stage" ? (
        <ReSheet title="Change stage" description="This updates only this search." onClose={() => setPanel(null)} placement="bottom">
          <ul className="space-y-1">
            {SEARCH_STAGES.filter((item) => item !== "paused" && item !== "closed").map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={cn("re-focus flex min-h-12 w-full items-center justify-between rounded-[10px] px-3 text-left text-[14px] font-medium", item === stage ? "bg-sales-surface-hover" : "hover:bg-sales-surface-hover")}
                  onClick={() => void patchSearch({ pipelineStage: item, closureReason: null })}
                >
                  {STAGE_LABEL[item]}
                  {item === stage ? <span className="text-[12px] text-sales-text-muted">Current</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 grid gap-2 border-t border-sales-border-subtle pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              const picked = (event.currentTarget.elements.namedItem("closing") as HTMLSelectElement).value;
              if ((picked === "paused" || picked === "closed") && !closureReason.trim()) {
                setError("Add a reason before pausing or closing this search.");
                return;
              }
              void patchSearch({ pipelineStage: picked, closureReason: closureReason.trim() || null });
            }}
          >
            <label className={acqLabelClass} htmlFor="closing-stage">Pause or close</label>
            <select id="closing-stage" name="closing" className={acqFieldClass} defaultValue="paused">
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
            <label className={acqLabelClass} htmlFor="closure-reason">Reason</label>
            <input id="closure-reason" className={acqFieldClass} value={closureReason} onChange={(event) => setClosureReason(event.target.value)} />
            <button className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")} type="submit" disabled={busy}>Save stage</button>
          </form>
        </ReSheet>
      ) : null}

      {panel?.kind === "requirements" ? (
        <ReSheet
          title="Edit requirements"
          onClose={() => setPanel(null)}
          footer={<div className="flex justify-end"><button form="edit-requirements" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} type="submit" disabled={busy}>{busy ? "Saving…" : "Save requirements"}</button></div>}
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
          <div className="flex justify-end gap-2">
            <button type="button" className="re-focus min-h-11 px-3 text-[14px] font-semibold" onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} disabled={busy} onClick={() => void act({ action: "interest", searchId, listingId: activeMatch.listingId, state: "recommended" })}>{busy ? "Saving…" : "Record recommendation"}</button>
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
            <Link href={listingsPath} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Open property</Link>
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

      {panel?.kind === "viewing" || panel?.kind === "reschedule" ? (
        <ReSheet title={panel.kind === "reschedule" ? "Reschedule viewing" : "Schedule viewing"} description="This updates the appointment. It does not message the customer." onClose={() => { setPanel(null); setOverlap(null); }}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const scheduledAt = new Date(String(data.get("when") || "")).toISOString();
              if (panel.kind === "reschedule") {
                void act({ action: "reschedule_viewing", viewingId: panel.viewingId, scheduledAt, confirmOverlap: false });
                return;
              }
              void act({
                action: "viewing",
                searchId,
                listingId: String(data.get("listingId") || ""),
                scheduledAt,
                instructions: String(data.get("instructions") || ""),
                confirmOverlap: false,
              });
            }}
          >
            {panel.kind === "viewing" ? (
              <>
                <label className={acqLabelClass} htmlFor="view-listing">Property</label>
                <select id="view-listing" required name="listingId" className={acqFieldClass} defaultValue="">
                  <option value="" disabled>{listingOptions.size ? "Choose a property" : "No matched or interested properties yet"}</option>
                  {[...listingOptions].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </>
            ) : <p className="text-[13px] text-sales-text-secondary">Current time stays until you save a new one.</p>}
            <label className={acqLabelClass} htmlFor="view-when">Date and time</label>
            <input id="view-when" required name="when" type="datetime-local" className={acqFieldClass} />
            {panel.kind === "viewing" ? (
              <>
                <label className={acqLabelClass} htmlFor="view-notes">Instructions</label>
                <input id="view-notes" name="instructions" className={acqFieldClass} />
              </>
            ) : null}
            {overlap ? (
              <div className="rounded-[10px] border border-sales-warning/40 bg-sales-warning-soft p-3" role="alert">
                <p className="text-[13px] font-semibold">This time clashes</p>
                <p className="mt-1 text-[13px]">{overlap.warning}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setOverlap(null)}>Change time</button>
                  <button type="button" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "sm" }), "min-h-11")} disabled={busy} onClick={() => void act({ ...overlap.body, confirmOverlap: true })}>Continue anyway</button>
                </div>
              </div>
            ) : null}
            <button className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} type="submit" disabled={busy}>{busy ? "Saving…" : panel.kind === "reschedule" ? "Save new time" : "Schedule viewing"}</button>
          </form>
        </ReSheet>
      ) : null}

      {panel?.kind === "outcome" ? (
        <ReSheet title="Record viewing outcome" onClose={() => setPanel(null)} footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="re-focus min-h-11 px-3 text-[14px] font-semibold" onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} disabled={busy || !outcome} onClick={() => void act({ action: "viewing_outcome", viewingId: panel.viewingId, outcome, note: outcomeNote || null })}>Save outcome</button>
          </div>
        }>
          {OUTCOME_GROUPS.map((group) => (
            <fieldset key={group.title} className="mb-3">
              <legend className={acqLabelClass}>{group.title}</legend>
              <ul>
                {group.values.filter((value) => (VIEWING_OUTCOMES as readonly string[]).includes(value)).map((value) => (
                  <li key={value}>
                    <label className="flex min-h-12 items-center gap-3 text-[14px]">
                      <input type="radio" name="outcome" checked={outcome === value} onChange={() => setOutcome(value)} />
                      {OUTCOME_LABEL[value]}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
          <label className={acqLabelClass} htmlFor="outcome-note">Note <span className="font-normal">optional</span></label>
          <input id="outcome-note" className={acqFieldClass} value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} />
        </ReSheet>
      ) : null}

      {panel?.kind === "application" ? (
        <ReSheet title="Submit rental application" description="Submitting an application does not mark the property let." onClose={() => setPanel(null)}>
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act({ action: "rental_application", searchId, listingId: String(data.get("listingId") || ""), notes: String(data.get("notes") || "") }); }}>
            <label className={acqLabelClass} htmlFor="app-listing">Property</label>
            <select id="app-listing" required name="listingId" className={acqFieldClass} defaultValue="">
              <option value="" disabled>Choose a property</option>
              {[...listingOptions].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <label className={acqLabelClass} htmlFor="app-notes">Notes</label>
            <input id="app-notes" name="notes" className={acqFieldClass} />
            <button className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} type="submit" disabled={busy}>{busy ? "Saving…" : "Submit application"}</button>
          </form>
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

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-sales-text-muted">{label}</dt>
      <dd className="mt-1 font-display text-[22px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
