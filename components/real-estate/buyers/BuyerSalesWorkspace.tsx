"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABEL,
  SEARCH_STAGES,
  STAGE_LABEL,
  asPropertyCategories,
  type PropertyCategory,
  type SearchStage,
} from "@/lib/real-estate/buyer-match";

type SearchRow = {
  id: string;
  contact_id: string;
  contact_name: string;
  phone: string | null;
  intent: string;
  property_type: string | null;
  property_categories?: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  locations: string[] | null;
  bedrooms: number | null;
  pipeline_stage: string | null;
  status: string;
  next_action_at: string | null;
  agent_name: string | null;
  updated_at: string;
};

type Metrics = {
  activeBuyers: number;
  activeTenants: number;
  newSearches: number;
  viewingsScheduled: number;
  offersInProgress: number;
  followUpDue: number;
};

const fieldClass =
  "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm text-sales-text-primary";

function categoryText(values: string[] | null | undefined): string {
  return asPropertyCategories(values ?? [])
    .map((category) => PROPERTY_CATEGORY_LABEL[category])
    .join(", ");
}

function money(row: SearchRow): string {
  const currency = row.currency || "USD";
  if (row.budget_max == null && row.budget_min == null) return "Budget not set";
  if (row.budget_min != null && row.budget_max != null) return `${currency} ${row.budget_min}–${row.budget_max}`;
  if (row.budget_max != null) return `Up to ${currency} ${row.budget_max}`;
  return `From ${currency} ${row.budget_min}`;
}

export function BuyerSalesWorkspace({ clientId, basePath }: { clientId: string; basePath: string }) {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [team, setTeam] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [intent, setIntent] = useState("");
  const [stage, setStage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [location, setLocation] = useState("");
  const [view, setView] = useState<"people" | "pipeline">("people");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    intent: "purchase",
    propertyType: "",
    categories: [] as PropertyCategory[],
    location: "",
    budgetMax: "",
    bedrooms: "",
  });

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (intent) params.set("intent", intent);
    if (stage) params.set("stage", stage);
    if (followUp) params.set("followUp", followUp);
    if (location) params.set("location", location);
    const [listRes, metricRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/buyer-searches?${params}`),
      fetch(`/api/clients/${clientId}/buyer-searches?metrics=1`),
    ]);
    const listJson = await listRes.json();
    const metricJson = await metricRes.json();
    if (!listRes.ok) {
      setError(listJson.error ?? "Could not load searches");
      return;
    }
    setError(null);
    setRows(listJson.searches ?? []);
    if (metricRes.ok) setMetrics(metricJson.metrics ?? null);
    const teamRes = await fetch(`/api/clients/${clientId}/buyer-reports?report=operations`);
    if (teamRes.ok) setTeam(await teamRes.json());
  }

  useEffect(() => {
    void load();
  }, [clientId, intent, stage, followUp, location]);

  const people = useMemo(() => {
    const groups = new Map<string, SearchRow[]>();
    for (const row of rows) {
      const list = groups.get(row.contact_id) ?? [];
      list.push(row);
      groups.set(row.contact_id, list);
    }
    return [...groups.entries()];
  }, [rows]);

  async function createSearch(confirmNewContact = false) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-searches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone || null,
        confirmNewContact,
        intent: form.intent,
        propertyType: form.propertyType || null,
        ...(form.categories.length ? { propertyCategories: form.categories } : {}),
        locations: form.location ? [form.location] : [],
        budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.status === 409 && json.duplicates?.length) {
      const useExisting = window.confirm(`${json.error} Use the existing contact instead?`);
      if (useExisting) {
        setBusy(true);
        const again = await fetch(`/api/clients/${clientId}/buyer-searches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: json.duplicates[0].id,
            intent: form.intent,
            propertyType: form.propertyType || null,
            ...(form.categories.length ? { propertyCategories: form.categories } : {}),
            locations: form.location ? [form.location] : [],
            budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
            bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          }),
        });
        const created = await again.json();
        setBusy(false);
        if (!again.ok) {
          setError(created.error ?? "Could not create the search");
          return;
        }
        window.location.href = `${basePath}/${created.search.id}`;
      }
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Could not create the search");
      return;
    }
    window.location.href = `${basePath}/${json.search.id}`;
  }

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-sales-text-primary">Buyers & Tenants</h1>
          <p className="text-sm text-sales-text-secondary">Manage property searches, customer requirements and sales opportunities.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white" onClick={() => setOpen(true)}>
            Add buyer / tenant
          </button>
          <Link href={basePath.replace("/buyers", "/matching")} className="inline-flex min-h-11 items-center rounded-md border border-sales-border px-3 text-sm">
            Find matching properties
          </Link>
        </div>
      </div>

      {metrics ? (
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Active buyers", metrics.activeBuyers],
            ["Active tenants", metrics.activeTenants],
            ["New searches", metrics.newSearches],
            ["Viewings scheduled", metrics.viewingsScheduled],
            ["Offers in progress", metrics.offersInProgress],
            ["Follow-up due", metrics.followUpDue],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-sales-border px-3 py-2">
              <dt className="text-[11px] text-sales-text-muted">{label}</dt>
              <dd className="text-lg font-semibold text-sales-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {team ? (
        <p className="text-xs text-sales-text-secondary">
          Team view: {String(team.activeSearches)} active searches, {String(team.pausedSearches)} paused, {String(team.completedSearches)} completed, {String(team.searchesWithoutNextAction)} active searches without a next action. These are search counts. An accepted offer is not a completed sale.
        </p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-5">
        <input className={fieldClass} placeholder="Name or phone" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} />
        <select className={fieldClass} value={intent} onChange={(event) => setIntent(event.target.value)}>
          <option value="">Buyer or tenant</option>
          <option value="purchase">Buying</option>
          <option value="rental">Renting</option>
        </select>
        <select className={fieldClass} value={stage} onChange={(event) => setStage(event.target.value)}>
          <option value="">Any stage</option>
          {SEARCH_STAGES.map((item) => (
            <option key={item} value={item}>{STAGE_LABEL[item]}</option>
          ))}
        </select>
        <input className={fieldClass} placeholder="Preferred location" value={location} onChange={(event) => setLocation(event.target.value)} />
        <select className={fieldClass} value={followUp} onChange={(event) => setFollowUp(event.target.value)}>
          <option value="">Follow-up</option>
          <option value="due">Due</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button type="button" className="min-h-9 rounded-md border border-sales-border px-3 text-xs" onClick={() => setView("people")}>Customers</button>
        <button type="button" className="min-h-9 rounded-md border border-sales-border px-3 text-xs" onClick={() => setView("pipeline")}>Search pipeline</button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {view === "people" ? (
        <div className="space-y-3">
          {people.length === 0 ? <p className="text-sm text-sales-text-secondary">No searches match these filters.</p> : null}
          {people.map(([contactId, searches]) => (
            <article key={contactId} className="rounded-lg border border-sales-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-sales-text-primary">{searches[0]?.contact_name}</h2>
                <p className="text-xs text-sales-text-secondary">{searches[0]?.phone || "Phone hidden"} · {searches[0]?.agent_name || "Unassigned"}</p>
              </div>
              <ul className="mt-2 space-y-2">
                {searches.map((search) => (
                  <li key={search.id}>
                    <Link href={`${basePath}/${search.id}`} className="grid gap-1 rounded-md bg-sales-surface-subtle px-3 py-2 text-sm md:grid-cols-4">
                      <span>{search.intent === "rental" ? "Rent" : "Buy"} · {categoryText(search.property_categories) || search.property_type || "Property type open"}</span>
                      <span>{money(search)}</span>
                      <span>{(search.locations ?? []).join(", ") || "Location open"}</span>
                      <span>{STAGE_LABEL[(search.pipeline_stage as SearchStage) || "actively_searching"] ?? search.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {SEARCH_STAGES.map((item) => (
            <section key={item} className="w-64 shrink-0 rounded-lg border border-sales-border">
              <h2 className="border-b border-sales-border-subtle px-3 py-2 text-xs font-semibold">{STAGE_LABEL[item]}</h2>
              <ul className="space-y-2 p-2">
                {rows.filter((row) => (row.pipeline_stage || "actively_searching") === item).map((row) => (
                  <li key={row.id}>
                    <Link href={`${basePath}/${row.id}`} className="block rounded-md border border-sales-border px-2 py-2 text-xs">
                      <span className="font-semibold">{row.contact_name}</span>
                      <span className="mt-1 block text-sales-text-secondary">{row.intent === "rental" ? "Rent" : "Buy"} · {money(row)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {open ? (
        <form
          className="fixed inset-x-0 bottom-0 z-40 max-h-[90vh] overflow-y-auto rounded-t-xl border border-sales-border bg-sales-surface p-4 shadow-lg md:inset-auto md:left-1/2 md:top-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"
          onSubmit={(event) => {
            event.preventDefault();
            void createSearch();
          }}
        >
          <h2 className="text-base font-semibold">New search</h2>
          <p className="mb-3 text-xs text-sales-text-secondary">A name and whether they want to buy or rent is enough to start.</p>
          <div className="grid gap-2">
            <input required className={fieldClass} placeholder="Customer name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className={fieldClass} placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <select className={fieldClass} value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value })}>
              <option value="purchase">Buying</option>
              <option value="rental">Renting</option>
            </select>
            <fieldset>
              <legend className="mb-1 text-xs text-sales-text-secondary">Property types (leave empty for any)</legend>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_CATEGORIES.map((category) => {
                  const on = form.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={on}
                      className={`min-h-9 rounded-full border px-3 text-xs ${on ? "border-sales-text-primary bg-sales-text-primary text-white" : "border-sales-border bg-sales-surface"}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          categories: on ? form.categories.filter((item) => item !== category) : [...form.categories, category],
                        })
                      }
                    >
                      {PROPERTY_CATEGORY_LABEL[category]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <input className={fieldClass} placeholder="Other property details, if any" value={form.propertyType} onChange={(event) => setForm({ ...form, propertyType: event.target.value })} />
            <input className={fieldClass} placeholder="Preferred suburb" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <input className={fieldClass} inputMode="decimal" placeholder={form.intent === "rental" ? "Monthly budget" : "Maximum budget"} value={form.budgetMax} onChange={(event) => setForm({ ...form, budgetMax: event.target.value })} />
            <input className={fieldClass} inputMode="numeric" placeholder="Bedrooms" value={form.bedrooms} onChange={(event) => setForm({ ...form, bedrooms: event.target.value })} />
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busy} className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white" type="submit">{busy ? "Saving…" : "Create search"}</button>
            <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
