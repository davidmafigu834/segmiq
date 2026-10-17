"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useMemo, useState } from "react";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABEL,
  SEARCH_STAGES,
  STAGE_LABEL,
  asPropertyCategories,
  type PropertyCategory,
  type SearchStage,
} from "@/lib/real-estate/buyer-match";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  ReFilterSheet,
  ReMetricGrid,
  ReMetricOverview,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatCard,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass, formatWhen, isOverdue } from "@/components/real-estate/acquisition/acquisition-ui";

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

type Duplicate = { id: string; name?: string | null; phone?: string | null };

const shell = reSalesShell;

function categoryText(values: string[] | null | undefined): string {
  return asPropertyCategories(values ?? [])
    .map((category) => PROPERTY_CATEGORY_LABEL[category])
    .join(", ");
}

function money(row: SearchRow): string {
  const currency = row.currency || "";
  const prefix = currency ? `${currency} ` : "";
  if (row.budget_max == null && row.budget_min == null) return "Budget not set";
  if (row.budget_min != null && row.budget_max != null) return `${prefix}${row.budget_min}–${row.budget_max}`;
  if (row.budget_max != null) return `Up to ${prefix}${row.budget_max}`;
  return `From ${prefix}${row.budget_min}`;
}

function summary(row: SearchRow): string {
  const kind = categoryText(row.property_categories) || row.property_type || "Property type open";
  const place = (row.locations ?? []).filter(Boolean).join(", ") || "Location open";
  const beds = row.bedrooms != null ? `${row.bedrooms}+ bed` : null;
  return [kind, place, beds].filter(Boolean).join(" · ");
}

function stageOf(row: SearchRow): string {
  return STAGE_LABEL[(row.pipeline_stage as SearchStage) || "actively_searching"] ?? row.status;
}

export function BuyerSalesWorkspace({ clientId, basePath, framed = false }: { clientId: string; basePath: string; framed?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [listTotal, setListTotal] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsState, setMetricsState] = useState<"loading" | "ready" | "error">("loading");
  const [team, setTeam] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [intent, setIntent] = useState("");
  const [stage, setStage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [location, setLocation] = useState("");
  const [view, setView] = useState<"people" | "pipeline">("people");
  const [pipelineStage, setPipelineStage] = useState<string>(SEARCH_STAGES[2]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState({ intent: "", stage: "", followUp: "", location: "" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    intent: "purchase",
    propertyType: "",
    categories: [] as PropertyCategory[],
    location: "",
    budgetMax: "",
    bedrooms: "",
    nextNote: "",
    nextAt: "",
  });

  async function load(next?: { q?: string }) {
    setLoading(true);
    const params = new URLSearchParams();
    const query = next?.q ?? q;
    if (query) params.set("q", query);
    if (intent) params.set("intent", intent);
    if (stage) params.set("stage", stage);
    if (followUp) params.set("followUp", followUp);
    if (location) params.set("location", location);
    const [listRes, metricRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/buyer-searches?${params}`),
      fetch(`/api/clients/${clientId}/buyer-searches?metrics=1`),
    ]);
    const listJson = await listRes.json().catch(() => ({}));
    const metricJson = await metricRes.json().catch(() => ({}));
    if (!listRes.ok) {
      setError(listJson.error ?? "Could not load searches");
      setLoading(false);
      return;
    }
    setError(null);
    setRows(listJson.searches ?? []);
    setListTotal(typeof listJson.total === "number" ? listJson.total : null);
    if (metricRes.ok) {
      setMetrics(metricJson.metrics ?? null);
      setMetricsState("ready");
    } else setMetricsState("error");
    const teamRes = await fetch(`/api/clients/${clientId}/buyer-reports?report=operations`);
    if (teamRes.ok) setTeam(await teamRes.json());
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, intent, stage, followUp, location]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    setOpen(true);
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const people = useMemo(() => {
    const groups = new Map<string, SearchRow[]>();
    for (const row of rows) {
      const list = groups.get(row.contact_id) ?? [];
      list.push(row);
      groups.set(row.contact_id, list);
    }
    return [...groups.entries()];
  }, [rows]);

  const filterCount = [intent, stage, followUp, location].filter(Boolean).length;
  const activeSearchCount = rows.filter((row) => row.status === "active" || !row.status).length;

  function payload(contactId?: string) {
    return {
      ...(contactId ? { contactId } : { name: form.name, phone: form.phone || null }),
      intent: form.intent,
      propertyType: form.propertyType || null,
      ...(form.categories.length ? { propertyCategories: form.categories } : {}),
      locations: form.location ? [form.location] : [],
      budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      ...(form.nextNote.trim() ? { nextActionNote: form.nextNote.trim() } : {}),
      ...(form.nextAt ? { nextActionAt: new Date(form.nextAt).toISOString() } : {}),
    };
  }

  async function createSearch(confirmNewContact = false, contactId?: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-searches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactId ? payload(contactId) : { ...payload(), confirmNewContact }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.status === 409 && json.duplicates?.length && !contactId) {
      setDuplicates(json.duplicates);
      setError(json.error ?? "A similar contact already exists.");
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Could not create the search");
      return;
    }
    window.location.href = `${basePath}/${json.search.id}`;
  }

  return (
    <div className={framed ? reEmbeddedShell : shell}>
      <RePageHeader
        title="Buyers & tenants"
        description="Manage property searches, customer relationships and active buying journeys."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border p-0.5" role="group" aria-label="Directory view">
              {(["people", "pipeline"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={view === item}
                  onClick={() => setView(item)}
                  className={cn(
                    "re-focus inline-flex h-10 items-center whitespace-nowrap rounded-[6px] px-3 text-[13px] font-semibold",
                    view === item ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary"
                  )}
                >
                  {item === "people" ? "Customers" : "Pipeline"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(true)} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:h-10")}>
              <Plus size={16} strokeWidth={1.8} aria-hidden />
              Add buyer / tenant
            </button>
          </div>
        }
      />

      <div className="order-last md:order-none">
      <ReMetricOverview label="Buyer and tenant overview">
      <ReMetricGrid label="Buyer and tenant summary">
        <ReStatCard label="Active buyers" value={metrics?.activeBuyers ?? null} supporting="People, not searches" state={metricsState} info="Counts people with an active purchase search, not the number of searches." />
        <ReStatCard label="Active tenants" value={metrics?.activeTenants ?? null} supporting="People, not searches" state={metricsState} info="Counts people with an active rental search, not the number of searches." />
        <ReStatCard label="Viewings scheduled" value={metrics?.viewingsScheduled ?? null} supporting="Booked visits, including searches that are no longer active" state={metricsState} href={basePath.replace("/buyers", "/viewings")} />
        <ReStatCard label="Follow-ups due" value={metrics?.followUpDue ?? null} state={metricsState} attention={Boolean(metrics && metrics.followUpDue > 0)} />
      </ReMetricGrid>
      </ReMetricOverview>
      </div>

      {team ? (
        <p className="hidden text-[13px] text-sales-text-secondary md:block">
          Team view: {String(team.buyers ?? "—")} buyers and {String(team.tenants ?? "—")} tenants, counted as people. {String(team.activeSearches)} active searches, {String(team.pausedSearches)} paused, {String(team.searchesWithoutNextAction)} with no next action.
          {team.incomplete ? " This team count is incomplete." : ""} An accepted offer is not a completed sale.
        </p>
      ) : null}

      <div className="flex min-w-0 items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search customers</span>
          <input
            className={acqFieldClass}
            placeholder="Name or phone"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
          />
        </label>
        <div className="hidden gap-2 md:flex">
          <select className={`${acqFieldClass} w-[150px]`} aria-label="Buying or renting" value={intent} onChange={(event) => setIntent(event.target.value)}>
            <option value="">Buyer or tenant</option>
            <option value="purchase">Buying</option>
            <option value="rental">Renting</option>
          </select>
          <select className={`${acqFieldClass} w-[190px]`} aria-label="Stage" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">Any stage</option>
            {SEARCH_STAGES.map((item) => <option key={item} value={item}>{STAGE_LABEL[item]}</option>)}
          </select>
          <input className={`${acqFieldClass} w-[160px]`} aria-label="Preferred location" placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
          <select className={`${acqFieldClass} w-[140px]`} aria-label="Follow-up" value={followUp} onChange={(event) => setFollowUp(event.target.value)}>
            <option value="">Follow-up</option>
            <option value="due">Due</option>
          </select>
        </div>
        <button
          type="button"
          className="re-focus inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold md:hidden"
          onClick={() => {
            setDraft({ intent, stage, followUp, location });
            setFiltersOpen(true);
          }}
        >
          Filters{filterCount ? ` (${filterCount})` : ""}
        </button>
      </div>

      {error && !open ? <ReErrorState title="Searches didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading buyers and tenants" /> : null}

      {!loading && !error && rows.length === 0 ? (
        <ReEmptyState
          framed
          title="No buyers or tenants yet"
          description="Record a customer and whether they want to buy or rent. A name is enough to start."
          action={
            <button type="button" onClick={() => setOpen(true)} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>
              Add buyer / tenant
            </button>
          }
        />
      ) : null}

      {!loading && !error && rows.length > 0 && view === "people" ? (
        <ReSection id="buyers" title="Customers" count={people.length} description={`${activeSearchCount} searches in this view. A person with several searches is still one customer.`} flush>
          {listTotal != null && listTotal > rows.length ? (
            <RePartialNotice>
              Showing {rows.length} of {listTotal} searches. Narrow the search to see the rest. The directory loads one page from the existing list.
            </RePartialNotice>
          ) : null}
          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {people.map(([contactId, searches]) => {
              const first = searches[0]!;
              const lead = searches[0]!;
              const roles = [...new Set(searches.map((row) => (row.intent === "rental" ? "Tenant" : "Buyer")))].join(" · ");
              return (
                <li key={contactId} className="flex min-w-0 items-start gap-3 px-[14px] py-3.5 sm:px-4">
                  <span className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sales-surface-subtle text-sales-text-secondary sm:flex" aria-hidden>
                    <Users size={17} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold leading-snug text-sales-text-primary [overflow-wrap:anywhere]">{first.contact_name || "Unnamed customer"}</p>
                        <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                          {roles}
                          {searches.length > 1 ? ` · ${searches.length} active searches` : " · 1 search"}
                        </p>
                      </div>
                      <ReActionMenu
                        label={`Actions for ${first.contact_name || "customer"}`}
                        sheetTitle={first.contact_name || "Customer"}
                        actions={[
                          { id: "open", label: searches.length > 1 ? "View searches" : "Open search", onSelect: () => router.push(`${basePath}/${lead.id}`) },
                          { id: "match", label: "Find matching properties", onSelect: () => router.push(`${basePath.replace("/buyers", "/matching")}`) },
                          ...(first.phone
                            ? [
                                { id: "call", label: "Call", onSelect: () => { window.location.href = `tel:${first.phone}`; } },
                                { id: "wa", label: "WhatsApp", onSelect: () => { window.location.href = `https://wa.me/${String(first.phone).replace(/\D/g, "")}`; } },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                    <p className="mt-2 text-[14px] font-medium leading-snug text-sales-text-primary [overflow-wrap:anywhere]">{summary(lead)}</p>
                    <p className="mt-0.5 text-[13px] text-sales-text-secondary">{money(lead)}</p>
                    {searches.length > 1 ? (
                      <p className="mt-1 text-[12px] text-sales-text-muted">Plus {searches.length - 1} other {searches.length - 1 === 1 ? "search" : "searches"}. Each stays separate.</p>
                    ) : null}
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                      <ReStatusBadge label={stageOf(lead)} />
                      <span className={cn("text-[12px]", isOverdue(lead.next_action_at, lead.status) ? "font-semibold text-sales-warning-fg" : "text-sales-text-muted")}>
                        {lead.agent_name || "Unassigned"}
                        {lead.next_action_at ? ` · ${isOverdue(lead.next_action_at, lead.status) ? "Overdue" : "Next"} ${formatWhen(lead.next_action_at)}` : " · No next step"}
                      </span>
                    </div>
                    <a
                      href={`${basePath}/${lead.id}`}
                      className="re-focus mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary underline-offset-2 hover:underline"
                    >
                      {searches.length > 1 ? "View searches" : "Open search"}
                      <span className="sr-only"> for {first.contact_name || "customer"}</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-sales-border-subtle text-[12px] text-sales-text-muted">
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Search</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Next</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const siblings = rows.filter((item) => item.contact_id === row.contact_id).length;
                  return (
                    <tr key={row.id} className="border-b border-sales-border-subtle last:border-0">
                      <td className="max-w-[220px] px-4 py-3 align-top">
                        <p className="font-semibold text-sales-text-primary [overflow-wrap:anywhere]">{row.contact_name || "Unnamed customer"}</p>
                        <p className="mt-0.5 text-[12px] text-sales-text-secondary">{row.intent === "rental" ? "Tenant" : "Buyer"}{siblings > 1 ? ` · ${siblings} searches` : ""}</p>
                      </td>
                      <td className="max-w-[280px] px-3 py-3 align-top">
                        <p className="font-medium [overflow-wrap:anywhere]">{summary(row)}</p>
                        <p className="mt-0.5 text-[12px] text-sales-text-secondary">{money(row)}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-sales-text-secondary">{row.agent_name || "Unassigned"}</td>
                      <td className="px-3 py-3 align-top"><ReStatusBadge label={stageOf(row)} /></td>
                      <td className={cn("px-3 py-3 align-top", isOverdue(row.next_action_at, row.status) && "font-semibold text-sales-warning-fg")}>
                        {row.next_action_at ? `${isOverdue(row.next_action_at, row.status) ? "Overdue" : "Due"} ${formatWhen(row.next_action_at)}` : "None recorded"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <a href={`${basePath}/${row.id}`} className="re-focus inline-flex min-h-11 items-center font-semibold">Open search</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReSection>
      ) : null}

      {!loading && !error && rows.length > 0 && view === "pipeline" ? (
        <Pipeline rows={rows} basePath={basePath} stage={pipelineStage} onStage={setPipelineStage} />
      ) : null}

      {filtersOpen ? (
        <ReFilterSheet
          title="Filter searches"
          activeCount={filterCount}
          onClose={() => setFiltersOpen(false)}
          onClear={() => setDraft({ intent: "", stage: "", followUp: "", location: "" })}
          onApply={() => {
            setIntent(draft.intent);
            setStage(draft.stage);
            setFollowUp(draft.followUp);
            setLocation(draft.location);
            setFiltersOpen(false);
          }}
        >
          <label className={acqLabelClass} htmlFor="buyer-intent">Buying or renting</label>
          <select id="buyer-intent" className={acqFieldClass} value={draft.intent} onChange={(event) => setDraft({ ...draft, intent: event.target.value })}>
            <option value="">Either</option>
            <option value="purchase">Buying</option>
            <option value="rental">Renting</option>
          </select>
          <label className={`${acqLabelClass} mt-3`} htmlFor="buyer-stage">Stage</label>
          <select id="buyer-stage" className={acqFieldClass} value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })}>
            <option value="">Any stage</option>
            {SEARCH_STAGES.map((item) => <option key={item} value={item}>{STAGE_LABEL[item]}</option>)}
          </select>
          <label className={`${acqLabelClass} mt-3`} htmlFor="buyer-location">Location</label>
          <input id="buyer-location" className={acqFieldClass} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
          <label className={`${acqLabelClass} mt-3`} htmlFor="buyer-follow">Follow-up</label>
          <select id="buyer-follow" className={acqFieldClass} value={draft.followUp} onChange={(event) => setDraft({ ...draft, followUp: event.target.value })}>
            <option value="">Any</option>
            <option value="due">Due</option>
          </select>
        </ReFilterSheet>
      ) : null}

      {open ? (
        <ReSheet
          title="Add buyer or tenant"
          description="A name and whether they want to buy or rent is enough. Requirements can wait."
          onClose={() => { if (!busy) { setOpen(false); setDuplicates(null); } }}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="re-focus min-h-11 px-3 text-[14px] font-semibold text-sales-text-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" form="new-search" disabled={busy} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>
                {busy ? "Saving…" : "Create search"}
              </button>
            </div>
          }
        >
          <form id="new-search" className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void createSearch(); }}>
            <label className={acqLabelClass} htmlFor="buyer-name">Customer name</label>
            <input id="buyer-name" required className={acqFieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <label className={acqLabelClass} htmlFor="buyer-phone">Phone <span className="font-normal text-sales-text-muted">optional</span></label>
            <input id="buyer-phone" className={acqFieldClass} inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <fieldset>
              <legend className={acqLabelClass}>Search intent</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["purchase", "rental"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={form.intent === item}
                    onClick={() => setForm({ ...form, intent: item })}
                    className={cn(
                      "re-focus min-h-11 rounded-[var(--re-radius-control,8px)] border text-[14px] font-semibold",
                      form.intent === item ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border"
                    )}
                  >
                    {item === "purchase" ? "Buying" : "Renting"}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={acqLabelClass}>Property types <span className="font-normal">optional</span></legend>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_CATEGORIES.map((category) => {
                  const on = form.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={on}
                      className={cn("re-focus min-h-11 rounded-full border px-3 text-[13px] font-semibold", on ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border")}
                      onClick={() => setForm({ ...form, categories: on ? form.categories.filter((item) => item !== category) : [...form.categories, category] })}
                    >
                      {PROPERTY_CATEGORY_LABEL[category]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className={acqLabelClass} htmlFor="buyer-place">Preferred suburb</label>
            <input id="buyer-place" className={acqFieldClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <label className={acqLabelClass} htmlFor="buyer-budget">{form.intent === "rental" ? "Monthly budget" : "Maximum budget"}</label>
            <input id="buyer-budget" className={acqFieldClass} inputMode="decimal" value={form.budgetMax} onChange={(event) => setForm({ ...form, budgetMax: event.target.value })} />
            <label className={acqLabelClass} htmlFor="buyer-beds">Bedrooms</label>
            <input id="buyer-beds" className={acqFieldClass} inputMode="numeric" value={form.bedrooms} onChange={(event) => setForm({ ...form, bedrooms: event.target.value })} />
            <label className={acqLabelClass} htmlFor="buyer-next">Next follow-up <span className="font-normal">optional</span></label>
            <input id="buyer-next" className={acqFieldClass} value={form.nextNote} onChange={(event) => setForm({ ...form, nextNote: event.target.value })} />
            <label className={acqLabelClass} htmlFor="buyer-next-at">When</label>
            <input id="buyer-next-at" type="datetime-local" className={acqFieldClass} value={form.nextAt} onChange={(event) => setForm({ ...form, nextAt: event.target.value })} />
            {duplicates?.length ? (
              <div className="rounded-[var(--re-radius-control,8px)] border border-sales-border p-3" role="alert">
                <p className="text-[13px] font-semibold">A similar contact already exists</p>
                <p className="mt-1 text-[13px] text-sales-text-secondary">{error}</p>
                <ul className="mt-2 space-y-2">
                  {duplicates.map((row) => (
                    <li key={row.id}>
                      <button type="button" className="re-focus min-h-11 text-left text-[13px] font-semibold underline-offset-2 hover:underline" onClick={() => void createSearch(false, row.id)}>
                        Use {row.name || row.phone || "existing contact"}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="re-focus mt-2 min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void createSearch(true)}>
                  Create a new contact anyway
                </button>
              </div>
            ) : error && open ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
          </form>
        </ReSheet>
      ) : null}
    </div>
  );
}

function Pipeline({
  rows,
  basePath,
  stage,
  onStage,
}: {
  rows: SearchRow[];
  basePath: string;
  stage: string;
  onStage: (value: string) => void;
}) {
  const columns = SEARCH_STAGES.map((item) => ({
    item,
    label: STAGE_LABEL[item],
    rows: rows.filter((row) => (row.pipeline_stage || "actively_searching") === item),
  }));
  const current = columns.find((column) => column.item === stage) ?? columns[0]!;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden" role="tablist" aria-label="Search stage">
        {columns.map((column) => (
          <button
            key={column.item}
            type="button"
            role="tab"
            aria-selected={current.item === column.item}
            onClick={() => onStage(column.item)}
            className={cn(
              "re-focus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold",
              current.item === column.item ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border"
            )}
          >
            {column.label}
            <span className="tabular-nums">{column.rows.length}</span>
          </button>
        ))}
      </div>
      <ul className="space-y-2 md:hidden">
        {current.rows.length === 0 ? <li className="text-[13px] text-sales-text-muted">Nothing in {current.label.toLowerCase()}.</li> : null}
        {current.rows.map((row) => (
          <li key={row.id}>
            <a href={`${basePath}/${row.id}`} className="re-focus block rounded-[10px] border border-sales-border-subtle bg-sales-surface px-3 py-2.5">
              <span className="block text-[14px] font-semibold">{row.contact_name}</span>
              <span className="mt-0.5 block text-[12px] text-sales-text-secondary">{row.intent === "rental" ? "Renting" : "Buying"} · {money(row)}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="hidden min-w-0 md:block">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <section key={column.item} className="w-[272px] shrink-0 rounded-[var(--re-radius-card,12px)] border border-sales-border-subtle bg-sales-surface-subtle p-2">
              <header className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-semibold">{column.label}</h2>
                <span className="text-[12px] tabular-nums text-sales-text-muted">{column.rows.length}</span>
              </header>
              <ul className="space-y-2">
                {column.rows.map((row) => (
                  <li key={row.id}>
                    <a href={`${basePath}/${row.id}`} className="re-focus block rounded-[10px] border border-sales-border-subtle bg-sales-surface px-3 py-2.5">
                      <span className="block truncate text-[13px] font-semibold">{row.contact_name}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-sales-text-secondary">{row.intent === "rental" ? "Renting" : "Buying"} · {money(row)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
