"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ACQUISITION_SOURCES, ACQUISITION_STAGES, SOURCE_LABEL, STAGE_LABEL } from "@/lib/real-estate/acquisition-plan";

type Opportunity = {
  id: string;
  reference_number: string;
  owner_name: string | null;
  suburb: string | null;
  city: string | null;
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

const fieldClass =
  "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm text-sales-text-primary";

export function AcquisitionWorkspace({
  clientId,
  basePath,
}: {
  clientId: string;
  basePath: string;
}) {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [intent, setIntent] = useState("");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stage) params.set("stage", stage);
    if (intent) params.set("intent", intent);
    const [listRes, overviewRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/acquisitions?${params}`, { cache: "no-store" }),
      fetch(`/api/clients/${clientId}/acquisitions/overview`, { cache: "no-store" }),
    ]);
    const listJson = await listRes.json();
    const overviewJson = await overviewRes.json();
    if (!listRes.ok) setError(listJson.error ?? "Could not load opportunities");
    else {
      setRows(listJson.opportunities ?? []);
      setError(null);
    }
    if (overviewRes.ok) setSummary(overviewJson.summary ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, stage, intent]);

  const grouped = useMemo(() => {
    return ACQUISITION_STAGES.map((key) => ({
      key,
      label: STAGE_LABEL[key],
      items: rows.filter((row) => row.stage === key && row.status === "active"),
    }));
  }, [rows]);

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-sales-text-primary">Property Opportunities</h1>
          <p className="text-sm text-sales-text-secondary">Find, manage and secure properties for your agency.</p>
        </div>
        <button type="button" className="min-h-11 rounded-md bg-sales-text-primary px-4 text-sm font-medium text-white" onClick={() => setOpen(true)}>
          + New Opportunity
        </button>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            ["Active", summary.active],
            ["In progress", summary.inProgress],
            ["Overdue follow-ups", summary.overdue],
            ["Converted", summary.converted],
            ["Lost", summary.lost],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-sales-border-subtle px-3 py-2">
              <p className="text-[11px] text-sales-text-muted">{label}</p>
              <p className="text-lg font-semibold text-sales-text-primary">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input className={`${fieldClass} max-w-xs`} placeholder="Search owner or location" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} />
        <select className={`${fieldClass} max-w-[200px]`} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          {ACQUISITION_STAGES.map((key) => <option key={key} value={key}>{STAGE_LABEL[key]}</option>)}
        </select>
        <select className={`${fieldClass} max-w-[140px]`} value={intent} onChange={(e) => setIntent(e.target.value)}>
          <option value="">Sale or rent</option>
          <option value="sale">Sale</option>
          <option value="rent">Rent</option>
          <option value="unknown">Not yet known</option>
        </select>
        <button type="button" className="min-h-11 rounded-md border border-sales-border px-3 text-sm" onClick={() => setView(view === "list" ? "pipeline" : "list")}>
          {view === "list" ? "Pipeline view" : "List view"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-sales-text-muted">Loading opportunities…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-sales-border px-4 py-8 text-sm text-sales-text-secondary">
          No property opportunities yet. Record one when you hear about an owner, even if the price and documents are still unknown.
        </p>
      ) : null}

      {view === "list" ? (
        <ul className="divide-y divide-sales-border-subtle rounded-md border border-sales-border-subtle">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`${basePath}/${row.id}`} className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-sales-surface-hover">
                <div>
                  <p className="text-sm font-medium text-sales-text-primary">{row.owner_name || "Owner not named"} · {row.suburb || row.city || "Location pending"}</p>
                  <p className="text-xs text-sales-text-secondary">{row.property_intent} · {STAGE_LABEL[row.stage as keyof typeof STAGE_LABEL] ?? row.stage} · {row.status}</p>
                </div>
                <p className="text-xs text-sales-text-muted">{row.next_action_at ? `Next ${new Date(row.next_action_at).toLocaleDateString()}` : "No next step"}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {grouped.map((column) => (
            <div key={column.key} className="w-56 shrink-0 rounded-md border border-sales-border-subtle p-2">
              <p className="mb-2 text-xs font-medium text-sales-text-secondary">{column.label}</p>
              <ul className="space-y-2">
                {column.items.map((row) => (
                  <li key={row.id}>
                    <Link href={`${basePath}/${row.id}`} className="block rounded-md border border-sales-border-subtle px-2 py-2 text-xs hover:bg-sales-surface-hover">
                      <span className="font-medium text-sales-text-primary">{row.owner_name || row.reference_number}</span>
                      <span className="mt-1 block text-sales-text-muted">{row.suburb || "Location pending"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <form
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void create(new FormData(event.currentTarget));
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-sales-surface p-4 shadow-lg">
            <h2 className="text-base font-semibold text-sales-text-primary">New opportunity</h2>
            <p className="mb-3 text-xs text-sales-text-secondary">A name or phone and a location are enough. Price and photos can wait.</p>
            <div className="grid gap-2">
              <input name="ownerName" className={fieldClass} placeholder="Owner name" />
              <input name="ownerPhone" className={fieldClass} placeholder="Phone" />
              <input name="suburb" className={fieldClass} placeholder="Suburb" />
              <input name="city" className={fieldClass} placeholder="City" />
              <select name="intent" className={fieldClass} defaultValue="unknown">
                <option value="unknown">Sell or rent not yet known</option>
                <option value="sale">Wants to sell</option>
                <option value="rent">Wants to rent out</option>
              </select>
              <select name="source" className={fieldClass} defaultValue="referral">
                {ACQUISITION_SOURCES.map((source) => <option key={source} value={source}>{SOURCE_LABEL[source]}</option>)}
              </select>
              <textarea name="notes" className={fieldClass} placeholder="Notes" rows={3} />
              <label className="text-xs text-sales-text-secondary">Next action
                <input name="nextActionAt" type="datetime-local" className={fieldClass} />
              </label>
              <label className="flex items-center gap-2 text-xs text-sales-text-secondary">
                <input name="confirmNewContact" type="checkbox" />
                Create a new contact even if a similar one exists
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="min-h-11 rounded-md bg-sales-text-primary px-4 text-sm text-white disabled:opacity-60">
                {saving ? "Saving…" : "Save opportunity"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
