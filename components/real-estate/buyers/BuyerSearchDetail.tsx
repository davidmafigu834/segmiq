"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABEL,
  REJECTION_REASONS,
  REJECTION_LABEL,
  STAGE_LABEL,
  VIEWING_OUTCOMES,
  asPropertyCategories,
  type PropertyCategory,
  type SearchStage,
} from "@/lib/real-estate/buyer-match";

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

type Match = {
  listingId: string;
  strength: string;
  reasons: string[];
  listing: {
    suburb?: string | null;
    address?: string | null;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    transaction_type?: string;
    photos?: unknown;
    agent_id?: string | null;
  } | null;
};

const fieldClass = "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm";

function photo(listing: Match["listing"]): string | null {
  const photos = listing?.photos;
  if (!Array.isArray(photos) || typeof photos[0] !== "string") return null;
  return photos[0];
}

export function BuyerSearchDetail({
  clientId,
  searchId,
  offersHref,
}: {
  clientId: string;
  searchId: string;
  offersHref: string;
}) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [categories, setCategories] = useState<PropertyCategory[]>([]);

  async function load() {
    const [bundleRes, matchRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/buyer-searches/${searchId}`),
      fetch(`/api/clients/${clientId}/matching?searchId=${searchId}`),
    ]);
    const bundleJson = await bundleRes.json();
    const matchJson = await matchRes.json();
    if (!bundleRes.ok) {
      setError(bundleJson.error ?? "Could not open this search");
      return;
    }
    setBundle(bundleJson);
    setMatches(matchRes.ok ? matchJson.matches ?? [] : []);
    const search = bundleJson.search as Record<string, unknown>;
    setBudget(search.budget_max == null ? "" : String(search.budget_max));
    setLocation(Array.isArray(search.locations) ? String(search.locations[0] ?? "") : "");
    setCategories(asPropertyCategories(search.property_categories));
  }

  async function patchSearch(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-searches/${searchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Could not save the search.");
    }
    await load();
  }

  useEffect(() => {
    void load();
  }, [clientId, searchId]);

  async function act(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not save");
      return;
    }
    await load();
  }

  if (!bundle) return <p className="p-4 text-sm text-sales-text-secondary">{error ?? "Loading search…"}</p>;
  const search = bundle.search;
  const stage = (search.pipeline_stage as SearchStage) || "actively_searching";
  const phone = bundle.contact?.phone;
  const rejected = new Set(
    bundle.interests.filter((row) => row.interest_state === "not_interested").map((row) => String(row.listing_id))
  );
  const savedCategories = asPropertyCategories(search.property_categories);
  const categoryLabel = savedCategories.map((category) => PROPERTY_CATEGORY_LABEL[category]).join(", ");
  const listingOptions = new Map<string, string>();
  for (const match of matches) {
    const label = [match.listing?.address, match.listing?.suburb].filter(Boolean).join(", ") || "Matched property";
    listingOptions.set(match.listingId, `${label} (${match.strength} match)`);
  }
  for (const interest of bundle.interests) {
    const id = String(interest.listing_id ?? "");
    if (id && !rejected.has(id) && !listingOptions.has(id)) {
      listingOptions.set(id, `Recorded interest (${String(interest.interest_state || interest.status || "interested")})`);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <header className="space-y-2">
        <p className="text-xs text-sales-text-muted">{search.intent === "rental" ? "Rent" : "Buy"} · {STAGE_LABEL[stage] ?? stage}</p>
        <h1 className="text-xl font-semibold text-sales-text-primary">{bundle.contact?.name ?? "Customer"}</h1>
        <p className="text-sm text-sales-text-secondary">
          {categoryLabel || (search.property_type as string) || "Property type open"}
          {" · "}
          {search.budget_max != null ? `Up to ${search.currency || "USD"} ${search.budget_max}` : "Budget open"}
          {" · "}
          {Array.isArray(search.locations) ? (search.locations as string[]).join(", ") || "Location open" : "Location open"}
          {search.bedrooms != null ? ` · ${search.bedrooms} bed` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <a className="inline-flex min-h-11 items-center rounded-md border border-sales-border px-3 text-sm" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
          ) : null}
          {phone ? <a className="inline-flex min-h-11 items-center rounded-md border border-sales-border px-3 text-sm" href={`tel:${phone}`}>Call</a> : null}
          <a className="inline-flex min-h-11 items-center rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white" href="#matches">Find properties</a>
        </div>
        {bundle.roles.some((role) => role.role === "seller" || role.role === "landlord") ? (
          <p className="text-xs text-sales-text-secondary">This person also has a property-owner role. Acquisition records stay on the property opportunity, not on this search.</p>
        ) : null}
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-lg border border-sales-border p-3">
        <h2 className="text-sm font-semibold">Next action</h2>
        <p className="text-sm text-sales-text-secondary">{(search.next_action_note as string) || "No next action recorded."}</p>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input className={fieldClass} placeholder="What should happen next" value={note} onChange={(event) => setNote(event.target.value)} />
          <input className={fieldClass} type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          <button
            type="button"
            className="min-h-11 rounded-md border border-sales-border px-3 text-sm"
            onClick={() => void fetch(`/api/clients/${clientId}/buyer-searches/${searchId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nextActionNote: note, nextActionAt: when ? new Date(when).toISOString() : null }),
            }).then(() => load())}
          >
            Add follow-up
          </button>
        </div>
      </section>

      <section id="matches" className="space-y-2">
        <h2 className="text-sm font-semibold">Property matches</h2>
        {matches.length === 0 ? <p className="text-sm text-sales-text-secondary">No approved available listing matches this search.</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <article key={match.listingId} className="overflow-hidden rounded-lg border border-sales-border">
              {photo(match.listing) ? <img src={photo(match.listing)!} alt="" className="h-36 w-full object-cover" /> : <div className="h-20 bg-sales-surface-subtle" />}
              <div className="space-y-1 p-3 text-sm">
                <p className="font-semibold">{match.listing?.suburb || match.listing?.address || "Property"}</p>
                <p className="text-sales-text-secondary">
                  {match.listing?.price != null ? `$${Number(match.listing.price).toLocaleString()}` : "Price not recorded"}
                  {match.listing?.bedrooms != null ? ` · ${match.listing.bedrooms} bed` : ""}
                  {match.listing?.bathrooms != null ? ` · ${match.listing.bathrooms} bath` : ""}
                </p>
                <p className="text-xs font-semibold uppercase">{match.strength === "strong" ? "Strong match" : match.strength === "alternative" ? "Alternative option" : "Partial match"}</p>
                <ul className="text-xs text-sales-text-secondary">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link className="min-h-9 text-xs font-semibold" href={`/sales/listings`}>Open property</Link>
                  <button type="button" className="min-h-9 text-xs" onClick={() => void act({ action: "interest", searchId, listingId: match.listingId, state: "recommended" })}>Recommend</button>
                  <button type="button" className="min-h-9 text-xs" onClick={() => void act({ action: "interest", searchId, listingId: match.listingId, state: "interested" })}>Interested</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Interested properties</h2>
        {bundle.interests.length === 0 ? <p className="text-sm text-sales-text-secondary">Nothing recorded yet.</p> : null}
        <ul className="space-y-2">
          {bundle.interests.map((interest) => (
            <li key={String(interest.id)} className="rounded-md border border-sales-border px-3 py-2 text-sm">
              <p>{String(interest.interest_state || interest.status)} · {rejected.has(String(interest.listing_id)) ? REJECTION_LABEL[(interest.rejection_reason as keyof typeof REJECTION_LABEL) || "other"] : "Still in play"}</p>
              {interest.interest_state !== "not_interested" ? (
                <label className="mt-1 block text-xs">
                  Not interested because
                  <select
                    className={`${fieldClass} mt-1`}
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      void act({
                        action: "interest",
                        searchId,
                        listingId: interest.listing_id,
                        state: "not_interested",
                        rejectionReason: event.target.value,
                      });
                    }}
                  >
                    <option value="">Choose a reason</option>
                    {REJECTION_REASONS.map((reason) => <option key={reason} value={reason}>{REJECTION_LABEL[reason]}</option>)}
                  </select>
                </label>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-sales-border p-3">
          <h2 className="text-sm font-semibold">Schedule a viewing</h2>
          <form
            className="mt-2 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void act({
                action: "viewing",
                searchId,
                listingId: String(data.get("listingId") || ""),
                scheduledAt: new Date(String(data.get("when") || "")).toISOString(),
                instructions: String(data.get("instructions") || ""),
                confirmOverlap: data.get("confirm") === "on",
              });
            }}
          >
            <select required name="listingId" className={fieldClass} defaultValue="">
              <option value="" disabled>
                {listingOptions.size ? "Choose a property" : "No matched or interested properties yet"}
              </option>
              {[...listingOptions].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <input required name="when" type="datetime-local" className={fieldClass} />
            <input name="instructions" className={fieldClass} placeholder="Meeting instructions" />
            <label className="flex items-center gap-2 text-xs"><input name="confirm" type="checkbox" /> Confirm even if the agent has another viewing nearby</label>
            <button className="min-h-11 rounded-md border border-sales-border text-sm" type="submit">Schedule viewing</button>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {bundle.viewings.map((viewing) => (
              <li key={String(viewing.id)} className="rounded-md bg-sales-surface-subtle px-2 py-2">
                <p>{String(viewing.status)} · {viewing.scheduled_at ? new Date(String(viewing.scheduled_at)).toLocaleString() : ""}</p>
                {viewing.status === "scheduled" ? (
                  <select
                    className={`${fieldClass} mt-1`}
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      void act({ action: "viewing_outcome", viewingId: viewing.id, outcome: event.target.value, note: "Recorded from the search" });
                    }}
                  >
                    <option value="">Record outcome</option>
                    {VIEWING_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome.replaceAll("_", " ")}</option>)}
                  </select>
                ) : <p className="text-xs text-sales-text-secondary">{String(viewing.outcome || viewing.feedback_text || "")}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-sales-border p-3">
          <h2 className="text-sm font-semibold">Offers and applications</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {bundle.offers.map((offer) => (
              <li key={String(offer.id)}>{String(offer.status)} · {String(offer.currency || "USD")} {String(offer.current_offer_amount)}</li>
            ))}
          </ul>
          <Link href={offersHref} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold">Open offers</Link>
          {search.intent === "rental" ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void act({ action: "rental_application", searchId, listingId: String(data.get("listingId") || ""), notes: String(data.get("notes") || "") });
              }}
            >
              <select required name="listingId" className={fieldClass} defaultValue="">
                <option value="" disabled>
                  Choose a property
                </option>
                {[...listingOptions].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <input name="notes" className={fieldClass} placeholder="Application notes" />
              <button className="min-h-11 rounded-md border border-sales-border text-sm" type="submit">Submit rental application</button>
            </form>
          ) : null}
          <ul className="mt-2 text-xs text-sales-text-secondary">
            {bundle.applications.map((row) => (
              <li key={String(row.id)}>Application {String(row.status)} · deposit {String(row.deposit_status)}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-sales-border p-3">
        <h2 className="text-sm font-semibold">Requirements</h2>
        <form
          className="mt-2 grid gap-2 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const categoriesChanged =
              categories.length !== savedCategories.length || categories.some((item) => !savedCategories.includes(item));
            void patchSearch({
              budgetMax: budget ? Number(budget) : null,
              locations: location ? [location] : [],
              allowAboveBudget: (event.currentTarget.elements.namedItem("above") as HTMLInputElement).checked,
              ...(categoriesChanged ? { propertyCategories: categories } : {}),
            });
          }}
        >
          <fieldset className="md:col-span-3">
            <legend className="mb-1 text-xs text-sales-text-secondary">Property types (leave empty for any)</legend>
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_CATEGORIES.map((category) => {
                const on = categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={on}
                    className={`min-h-9 rounded-full border px-3 text-xs ${on ? "border-sales-text-primary bg-sales-text-primary text-white" : "border-sales-border bg-sales-surface"}`}
                    onClick={() =>
                      setCategories((current) => (on ? current.filter((item) => item !== category) : [...current, category]))
                    }
                  >
                    {PROPERTY_CATEGORY_LABEL[category]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <input className={fieldClass} value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Maximum budget" />
          <input className={fieldClass} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Preferred location" />
          <label className="flex items-center gap-2 text-xs"><input name="above" type="checkbox" defaultChecked={Boolean(search.allow_above_budget)} /> May consider above the stated maximum</label>
          <button className="min-h-11 rounded-md border border-sales-border text-sm" type="submit">Save requirements</button>
        </form>
        <label className="mt-3 block text-xs">
          Search stage
          <select
            className={`${fieldClass} mt-1`}
            value={stage}
            onChange={(event) => {
              void fetch(`/api/clients/${clientId}/buyer-searches/${searchId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  pipelineStage: event.target.value,
                  closureReason: event.target.value === "closed" || event.target.value === "paused" ? "Recorded by agent" : null,
                }),
              }).then(() => load());
            }}
          >
            {Object.entries(STAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Activity</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {bundle.events.map((event) => (
            <li key={String(event.id)} className="text-sales-text-secondary">
              {String(event.event_type)} {event.field_name ? `· ${String(event.field_name)}` : ""} {event.to_value ? `→ ${String(event.to_value)}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
