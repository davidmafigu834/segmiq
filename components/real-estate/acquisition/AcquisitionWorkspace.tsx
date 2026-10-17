"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { ACQUISITION_SOURCES, ACQUISITION_STAGES, SOURCE_LABEL, STAGE_LABEL } from "@/lib/real-estate/acquisition-plan";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell } from "@/components/real-estate/ui/workspace-shell";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  ReFilterSheet,
  ReMetricGrid,
  RePageHeader,
  RePartialNotice,
  ReRowAction,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatCard,
  ReStatusBadge,
  ReWorkItem,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass, formatWhen, intentLabel, isOverdue, placeLabel, stageLabel } from "./acquisition-ui";

type Opportunity = {
  id: string;
  reference_number: string;
  owner_name: string | null;
  suburb: string | null;
  city: string | null;
  address?: string | null;
  property_intent: string;
  stage: string;
  status: string;
  source: string;
  next_action_at: string | null;
  assigned_agent_id: string | null;
  updated_at: string;
};

type Summary = {
  active: number;
  inProgress: number;
  overdue: number;
  lost: number;
  converted: number;
};

const shellClass =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-[var(--re-section-gap,16px)] overflow-y-auto overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:pb-6";

export function AcquisitionWorkspace({
  clientId,
  basePath,
  framed = false,
}: {
  clientId: string;
  basePath: string;
  framed?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [overviewIncomplete, setOverviewIncomplete] = useState(false);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [intent, setIntent] = useState("");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [pipelineStage, setPipelineStage] = useState<string>(ACQUISITION_STAGES[0]);
  const [open, setOpen] = useState(false);
  const [lostId, setLostId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStage, setDraftStage] = useState("");
  const [draftIntent, setDraftIntent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function load(next?: { stage?: string; intent?: string; q?: string }) {
    setLoading(true);
    const params = new URLSearchParams();
    const query = next?.q ?? q;
    const stageValue = next?.stage ?? stage;
    const intentValue = next?.intent ?? intent;
    if (query) params.set("q", query);
    if (stageValue) params.set("stage", stageValue);
    if (intentValue) params.set("intent", intentValue);
    const [listRes, overviewRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/acquisitions?${params}`, { cache: "no-store" }),
      fetch(`/api/clients/${clientId}/acquisitions/overview`, { cache: "no-store" }),
    ]);
    const listJson = await listRes.json().catch(() => ({}));
    const overviewJson = await overviewRes.json().catch(() => ({}));
    if (!listRes.ok) setError(listJson.error ?? "Could not load opportunities");
    else {
      setRows(listJson.opportunities ?? []);
      setError(null);
    }
    if (overviewRes.ok) {
      setSummary(overviewJson.summary ?? null);
      setOverviewIncomplete(Boolean(overviewJson.incomplete));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, stage, intent]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    setOpen(true);
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const grouped = useMemo(() => {
    return ACQUISITION_STAGES.map((key) => ({
      key,
      label: STAGE_LABEL[key],
      items: rows.filter((row) => row.stage === key && row.status === "active"),
    }));
  }, [rows]);

  const mobileColumn = grouped.find((column) => column.key === pipelineStage) ?? grouped[0];
  const filterCount = Number(Boolean(stage)) + Number(Boolean(intent));

  async function outcome(id: string, status: "lost" | "on_hold", reason: string) {
    const res = await fetch(`/api/clients/${clientId}/acquisitions/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "outcome", status, reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not update the opportunity");
      return;
    }
    void load();
  }

  async function create(form: FormData) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/acquisitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        ownerName: form.get("ownerName") || null,
        ownerPhone: form.get("ownerPhone") || null,
        suburb: form.get("suburb") || null,
        city: form.get("city") || null,
        intent: form.get("intent") || "unknown",
        source: form.get("source") || "other",
        notes: form.get("notes") || null,
        nextActionAt: form.get("nextActionAt") || null,
        confirmNewContact: form.get("confirmNewContact") === "on",
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      const duplicates = Array.isArray(json.duplicates)
        ? json.duplicates.map((row: { name?: string | null; phone?: string | null }) => row.name || row.phone).filter(Boolean).join(", ")
        : "";
      setError(duplicates ? `${json.error} Matches: ${duplicates}` : json.error ?? "Could not save");
      return;
    }
    window.location.href = `${basePath}/${json.opportunity.id}`;
  }

  function rowMenu(row: Opportunity) {
    return [
      { id: "open", label: "Open opportunity", onSelect: () => router.push(`${basePath}/${row.id}`) },
      {
        id: "hold",
        label: "Put on hold",
        disabled: row.status === "on_hold" || row.status === "converted",
        onSelect: () => void outcome(row.id, "on_hold", "Paused"),
      },
      {
        id: "lost",
        label: "Mark lost",
        destructive: true,
        disabled: row.status === "lost" || row.status === "converted",
        onSelect: () => setLostId(row.id),
      },
    ];
  }

  return (
    <div className={framed ? reEmbeddedShell : shellClass}>
      <RePageHeader
        title="Property opportunities"
        description="Track potential properties from first contact to approved listing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[var(--re-radius-control,8px)] border border-sales-border p-0.5" role="group" aria-label="Opportunity view">
              {(["list", "pipeline"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={view === item}
                  onClick={() => setView(item)}
                  className={cn(
                    "re-focus min-h-11 rounded-[6px] px-3 text-[13px] font-semibold capitalize sm:min-h-9",
                    view === item ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary hover:bg-sales-surface-hover"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:h-10")}
            >
              <Plus size={16} strokeWidth={1.8} aria-hidden />
              New opportunity
            </button>
          </div>
        }
      />

      {overviewIncomplete ? <RePartialNotice>Some opportunities could not be counted. Totals may be short.</RePartialNotice> : null}
      <ReMetricGrid label="Acquisition summary">
        <ReStatCard label="Active opportunities" value={summary ? summary.active : null} supporting="Open or being nurtured" state={summary ? "ready" : loading ? "loading" : "error"} />
        <ReStatCard label="In progress" value={summary ? summary.inProgress : null} supporting="Status is active" state={summary ? "ready" : loading ? "loading" : "error"} />
        <ReStatCard label="Overdue follow-ups" value={summary ? summary.overdue : null} supporting="Next step is past due" state={summary ? "ready" : loading ? "loading" : "error"} attention={Boolean(summary && summary.overdue > 0)} />
        <ReStatCard label="Converted" value={summary ? summary.converted : null} supporting="Moved to a listing" state={summary ? "ready" : loading ? "loading" : "error"} />
        <ReStatCard label="Lost" value={summary ? summary.lost : null} supporting="Closed without a listing" state={summary ? "ready" : loading ? "loading" : "error"} />
      </ReMetricGrid>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search owner or location</span>
          <input
            className={acqFieldClass}
            placeholder="Search owner or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </label>
        <div className="hidden gap-2 md:flex">
          <select className={`${acqFieldClass} w-[200px]`} aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {ACQUISITION_STAGES.map((key) => <option key={key} value={key}>{STAGE_LABEL[key]}</option>)}
          </select>
          <select className={`${acqFieldClass} w-[160px]`} aria-label="Sale or rent" value={intent} onChange={(e) => setIntent(e.target.value)}>
            <option value="">Sale or rent</option>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
            <option value="unknown">Not yet known</option>
          </select>
        </div>
        <button
          type="button"
          className="re-focus inline-flex min-h-11 items-center justify-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary md:hidden"
          onClick={() => {
            setDraftStage(stage);
            setDraftIntent(intent);
            setFiltersOpen(true);
          }}
        >
          Filters{filterCount ? ` (${filterCount})` : ""}
        </button>
      </div>

      {error ? <ReErrorState title="Opportunities didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={5} label="Loading opportunities" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <ReSection id="acq-empty" title="No property opportunities yet">
          <ReEmptyState
            title="No property opportunities yet"
            description="Start by recording a property owner who may want to sell or rent. Price and documents can wait."
            action={
              <button type="button" onClick={() => setOpen(true)} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>
                New opportunity
              </button>
            }
          />
        </ReSection>
      ) : null}

      {!loading && !error && rows.length > 0 && view === "list" ? (
        <ReSection id="acq-list" title="Opportunities" count={rows.length} flush>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left">
              <caption className="sr-only">Property opportunities</caption>
              <thead>
                <tr className="border-y border-sales-border-subtle bg-sales-surface-subtle text-[12px] text-sales-text-secondary">
                  <th scope="col" className="w-[28%] px-[var(--re-card-pad,16px)] py-2 font-medium">Property</th>
                  <th scope="col" className="w-[16%] px-3 py-2 font-medium">Owner</th>
                  <th scope="col" className="w-[18%] px-3 py-2 font-medium">Stage</th>
                  <th scope="col" className="w-[16%] px-3 py-2 font-medium">Last activity</th>
                  <th scope="col" className="px-3 py-2 font-medium">Next action</th>
                  <th scope="col" className="w-[108px] px-3 py-2 pr-[var(--re-card-pad,16px)] font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {rows.map((row) => {
                  const overdue = isOverdue(row.next_action_at, row.status);
                  return (
                    <tr key={row.id} className="cursor-pointer hover:bg-sales-surface-hover" onClick={() => router.push(`${basePath}/${row.id}`)}>
                      <td className="px-[var(--re-card-pad,16px)] py-3">
                        <span className="block truncate text-[14px] font-semibold text-sales-text-primary">{placeLabel(row)}</span>
                        <span className="block truncate text-[12px] text-sales-text-muted">{intentLabel(row.property_intent)} · {row.reference_number}</span>
                      </td>
                      <td className="truncate px-3 py-3 text-[13px] text-sales-text-secondary">{row.owner_name || "Owner not recorded"}</td>
                      <td className="px-3 py-3"><ReStatusBadge label={stageLabel(row.stage)} tone={row.status === "lost" ? "danger" : row.status === "on_hold" ? "warning" : "neutral"} /></td>
                      <td className="px-3 py-3 text-[12px] text-sales-text-muted">{formatWhen(row.updated_at) ?? "—"}</td>
                      <td className={cn("px-3 py-3 text-[12px]", overdue ? "font-semibold text-sales-warning-fg" : "text-sales-text-secondary")}>
                        {row.next_action_at ? `${overdue ? "Overdue · " : ""}${formatWhen(row.next_action_at)}` : "No next step"}
                      </td>
                      <td className="px-3 py-3 pr-[var(--re-card-pad,16px)]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <ReRowAction label="Open" srContext={placeLabel(row)} href={`${basePath}/${row.id}`} />
                          <ReActionMenu actions={rowMenu(row)} label={`Actions for ${placeLabel(row)}`} sheetTitle={placeLabel(row)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-sales-border-subtle md:hidden" aria-label="Property opportunities">
            {rows.map((row) => {
              const overdue = isOverdue(row.next_action_at, row.status);
              return (
                <ReWorkItem
                  key={row.id}
                  icon={<Building2 />}
                  title={placeLabel(row)}
                  reason={`${intentLabel(row.property_intent)} · ${row.owner_name || "Owner not recorded"}`}
                  status={<ReStatusBadge label={stageLabel(row.stage)} tone={row.status === "lost" ? "danger" : "neutral"} />}
                  meta={
                    <span className={overdue ? "font-semibold text-sales-warning-fg" : undefined}>
                      {row.next_action_at ? `${overdue ? "Overdue · " : "Next · "}${formatWhen(row.next_action_at)}` : "No next step"}
                    </span>
                  }
                  action={<ReRowAction label="Open" srContext={placeLabel(row)} href={`${basePath}/${row.id}`} />}
                  menu={<ReActionMenu actions={rowMenu(row)} label={`Actions for ${placeLabel(row)}`} sheetTitle={placeLabel(row)} />}
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}

      {!loading && !error && rows.length > 0 && view === "pipeline" ? (
        <>
          <div className="md:hidden">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Acquisition stage">
              {grouped.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  role="tab"
                  aria-selected={mobileColumn?.key === column.key}
                  onClick={() => setPipelineStage(column.key)}
                  className={cn(
                    "re-focus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold",
                    mobileColumn?.key === column.key
                      ? "border-sales-text-primary bg-sales-text-primary text-sales-surface"
                      : "border-sales-border bg-sales-surface text-sales-text-secondary"
                  )}
                >
                  {column.label}
                  <span className="tabular-nums">{column.items.length}</span>
                </button>
              ))}
            </div>
            <ul className="mt-3 space-y-2" aria-label={mobileColumn?.label}>
              {mobileColumn && mobileColumn.items.length === 0 ? (
                <li className="rounded-[var(--re-radius-card,12px)] border border-dashed border-sales-border px-3 py-4 text-[13px] text-sales-text-muted">
                  Nothing active in {mobileColumn.label.toLowerCase()}.
                </li>
              ) : null}
              {mobileColumn?.items.map((row) => (
                <li key={row.id}>
                  <PipelineCard row={row} href={`${basePath}/${row.id}`} />
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Acquisition pipeline">
              {grouped.map((column) => (
                <section key={column.key} className="w-[272px] shrink-0 rounded-[var(--re-radius-card,12px)] border border-sales-border-subtle bg-sales-surface-subtle p-2" aria-labelledby={`stage-${column.key}`}>
                  <header className="mb-2 flex items-baseline justify-between gap-2 px-1">
                    <h2 id={`stage-${column.key}`} className="text-[13px] font-semibold text-sales-text-primary">{column.label}</h2>
                    <span className="text-[12px] tabular-nums text-sales-text-muted">{column.items.length}</span>
                  </header>
                  <ul className="space-y-2">
                    {column.items.map((row) => (
                      <li key={row.id}>
                        <PipelineCard row={row} href={`${basePath}/${row.id}`} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {filtersOpen ? (
        <ReFilterSheet
          title="Filter opportunities"
          activeCount={filterCount}
          onClose={() => setFiltersOpen(false)}
          onClear={() => {
            setDraftStage("");
            setDraftIntent("");
          }}
          onApply={() => {
            setStage(draftStage);
            setIntent(draftIntent);
            setFiltersOpen(false);
          }}
        >
          <label className={acqLabelClass} htmlFor="acq-filter-stage">Stage</label>
          <select id="acq-filter-stage" className={acqFieldClass} value={draftStage} onChange={(e) => setDraftStage(e.target.value)}>
            <option value="">All stages</option>
            {ACQUISITION_STAGES.map((key) => <option key={key} value={key}>{STAGE_LABEL[key]}</option>)}
          </select>
          <label className={`${acqLabelClass} mt-3`} htmlFor="acq-filter-intent">Sale or rent</label>
          <select id="acq-filter-intent" className={acqFieldClass} value={draftIntent} onChange={(e) => setDraftIntent(e.target.value)}>
            <option value="">Either</option>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
            <option value="unknown">Not yet known</option>
          </select>
        </ReFilterSheet>
      ) : null}

      {lostId ? (
        <ReSheet
          title="Mark opportunity lost"
          placement="bottom"
          onClose={() => setLostId(null)}
          footer={
            <button type="submit" form="list-mark-lost" className="re-focus min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-danger px-4 text-[14px] font-semibold text-sales-danger-fg">
              Mark lost
            </button>
          }
        >
          <form
            id="list-mark-lost"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
              const id = lostId;
              if (!reason || !id) return;
              setLostId(null);
              void outcome(id, "lost", reason);
            }}
          >
            <label className={acqLabelClass} htmlFor="list-lost-reason">Reason</label>
            <textarea id="list-lost-reason" name="reason" required minLength={3} className={acqFieldClass} rows={3} />
          </form>
        </ReSheet>
      ) : null}

      {open ? (
        <ReSheet
          title="New opportunity"
          description="A name or phone and a location are enough. Price and photos can wait."
          onClose={() => { if (!saving) setOpen(false); }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="re-focus min-h-11 rounded-[var(--re-radius-control,8px)] px-3 text-[14px] font-semibold text-sales-text-secondary" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="new-opportunity" disabled={saving} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>
                {saving ? "Saving…" : "Create opportunity"}
              </button>
            </div>
          }
        >
          <form
            id="new-opportunity"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void create(new FormData(event.currentTarget));
            }}
          >
            <fieldset className="grid gap-3">
              <legend className="text-[13px] font-semibold text-sales-text-primary">Property owner</legend>
              <label className={acqLabelClass} htmlFor="ownerName">Name <span className="font-normal text-sales-text-muted">optional if you add a phone</span></label>
              <input id="ownerName" name="ownerName" className={acqFieldClass} autoComplete="name" />
              <label className={acqLabelClass} htmlFor="ownerPhone">Phone</label>
              <input id="ownerPhone" name="ownerPhone" className={acqFieldClass} inputMode="tel" autoComplete="tel" />
              <label className="flex min-h-11 items-center gap-2 text-[13px] text-sales-text-secondary">
                <input name="confirmNewContact" type="checkbox" className="size-4" />
                Create a new contact even if a similar one exists
              </label>
            </fieldset>
            <fieldset className="grid gap-3">
              <legend className="text-[13px] font-semibold text-sales-text-primary">Property</legend>
              <label className={acqLabelClass} htmlFor="intent">Sale or rental</label>
              <select id="intent" name="intent" className={acqFieldClass} defaultValue="unknown">
                <option value="unknown">Not yet known</option>
                <option value="sale">Wants to sell</option>
                <option value="rent">Wants to rent out</option>
              </select>
              <label className={acqLabelClass} htmlFor="suburb">Suburb</label>
              <input id="suburb" name="suburb" className={acqFieldClass} />
              <label className={acqLabelClass} htmlFor="city">City</label>
              <input id="city" name="city" className={acqFieldClass} />
            </fieldset>
            <fieldset className="grid gap-3">
              <legend className="text-[13px] font-semibold text-sales-text-primary">Source and follow-up</legend>
              <label className={acqLabelClass} htmlFor="source">Source</label>
              <select id="source" name="source" className={acqFieldClass} defaultValue="referral">
                {ACQUISITION_SOURCES.map((source) => <option key={source} value={source}>{SOURCE_LABEL[source]}</option>)}
              </select>
              <label className={acqLabelClass} htmlFor="nextActionAt">Next action</label>
              <input id="nextActionAt" name="nextActionAt" type="datetime-local" className={acqFieldClass} />
              <label className={acqLabelClass} htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" className={acqFieldClass} rows={3} />
            </fieldset>
            {error && open ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
          </form>
        </ReSheet>
      ) : null}
    </div>
  );
}

function PipelineCard({ row, href }: { row: Opportunity; href: string }) {
  const overdue = isOverdue(row.next_action_at, row.status);
  return (
    <Link href={href} className="re-focus block rounded-[10px] border border-sales-border-subtle bg-sales-surface px-3 py-2.5 hover:bg-sales-surface-hover">
      <span className="block truncate text-[13px] font-semibold text-sales-text-primary">{placeLabel(row)}</span>
      <span className="mt-0.5 block truncate text-[12px] text-sales-text-secondary">{row.owner_name || "Owner not recorded"}</span>
      <span className="mt-1 flex items-center justify-between gap-2 text-[12px] text-sales-text-muted">
        <span>{intentLabel(row.property_intent)}</span>
        <span className={overdue ? "font-semibold text-sales-warning-fg" : undefined}>
          {row.next_action_at ? formatWhen(row.next_action_at) : "No next step"}
        </span>
      </span>
    </Link>
  );
}
