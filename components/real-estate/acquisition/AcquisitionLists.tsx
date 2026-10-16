"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MandateActions, type MandateRow } from "./MandateActions";

export function OwnerList({ clientId, basePath }: { clientId: string; basePath: string }) {
  const [owners, setOwners] = useState<Array<{ contactId: string; name: string | null; properties: number; active: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetch(`/api/clients/${clientId}/owners`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) setError(json.error ?? "Could not load owners");
        else setOwners(json.owners ?? []);
      });
  }, [clientId]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="text-xl font-semibold text-sales-text-primary">Property Owners</h1>
      <p className="mb-3 text-sm text-sales-text-secondary">One person can hold several properties. This uses the existing contacts.</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="divide-y divide-sales-border-subtle rounded-md border border-sales-border-subtle">
        {owners.map((owner) => (
          <li key={owner.contactId}>
            <Link href={`${basePath}?contactId=${owner.contactId}`} className="flex min-h-14 items-center justify-between px-3 text-sm">
              <span>{owner.name || "Unnamed owner"}</span>
              <span className="text-xs text-sales-text-muted">{owner.properties} properties · {owner.active} active</span>
            </Link>
          </li>
        ))}
      </ul>
      {owners.length === 0 && !error ? <p className="mt-3 text-sm text-sales-text-muted">No owners yet. Create an opportunity to start a portfolio.</p> : null}
    </div>
  );
}

export function InspectionList({ clientId, opportunityBase }: { clientId: string; opportunityBase: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    void fetch(`/api/clients/${clientId}/inspections`, { cache: "no-store" })
      .then(async (res) => setRows((await res.json()).inspections ?? []));
  }, [clientId]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="text-xl font-semibold text-sales-text-primary">Inspections</h1>
      <p className="mb-3 text-sm text-sales-text-secondary">Acquisition inspections are separate from buyer viewings.</p>
      <ul className="divide-y divide-sales-border-subtle rounded-md border border-sales-border-subtle">
        {rows.map((row) => (
          <li key={String(row.id)}>
            <Link href={`${opportunityBase}/${String(row.opportunity_id)}`} className="flex min-h-14 items-center justify-between px-3 text-sm">
              <span>{String(row.suburb || row.address || "Inspection")}</span>
              <span className="text-xs text-sales-text-muted">{String(row.status)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MANDATE_FILTERS = [
  { id: "attention", label: "Needs attention" },
  { id: "approved", label: "Active" },
  { id: "all", label: "All" },
] as const;

function mandateTone(status: string): string {
  if (status === "approved") return "text-emerald-700";
  if (status === "expiring_soon" || status === "submitted" || status === "awaiting_evidence") return "text-amber-700";
  if (status === "expired" || status === "revoked" || status === "rejected") return "text-red-700";
  return "text-sales-text-secondary";
}

export function MandateList({ clientId, opportunityBase }: { clientId: string; opportunityBase: string }) {
  const [rows, setRows] = useState<MandateRow[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof MANDATE_FILTERS)[number]["id"]>("attention");

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/mandates`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not load mandates.");
      return;
    }
    setError(null);
    setRows(json.mandates ?? []);
    setCanReview(Boolean(json.canReview));
    setIncomplete(Boolean(json.incomplete));
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((row) => {
    const status = String(row.displayStatus ?? row.status);
    if (filter === "all") return true;
    if (filter === "approved") return status === "approved" || status === "expiring_soon";
    return ["submitted", "awaiting_evidence", "expiring_soon", "expired"].includes(status) && !row.superseded_by_id;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="text-xl font-semibold text-sales-text-primary">Mandates</h1>
      <p className="mb-3 text-sm text-sales-text-secondary">
        Legacy listing fields stay unverified until a manager approves a new mandate. Renewals and revocations keep the earlier versions.
      </p>
      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Mandate filter">
        {MANDATE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-9 shrink-0 rounded-md px-3 text-sm ${filter === item.id ? "bg-sales-surface-selected font-semibold" : "text-sales-text-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="mb-2 text-sm text-red-600" role="alert">{error}</p> : null}
      {incomplete ? <p className="mb-2 text-xs text-amber-800">Some mandates could not be loaded. The list is not complete.</p> : null}
      <ul className="divide-y divide-sales-border-subtle rounded-md border border-sales-border-subtle">
        {visible.map((row) => {
          const status = String(row.displayStatus ?? row.status);
          return (
            <li key={row.id} className="space-y-1 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {row.opportunity_id ? (
                  <Link className="font-medium" href={`${opportunityBase}/${String(row.opportunity_id)}`}>{String(row.propertyLabel ?? "Property")}</Link>
                ) : (
                  <span className="font-medium">{String(row.propertyLabel ?? "Property")}</span>
                )}
                <span className={`text-xs font-semibold ${mandateTone(status)}`}>{status.replaceAll("_", " ")}</span>
              </div>
              <p className="text-xs text-sales-text-muted">
                {String(row.mandate_type ?? "Type pending")} · {row.start_date ? `${String(row.start_date)} to ` : ""}
                {row.expiry_date ? String(row.expiry_date) : "no expiry"} · evidence {String(row.evidence_status ?? "not provided").replaceAll("_", " ")}
                {row.previous_mandate_id ? " · renewal" : ""}
                {row.superseded_by_id ? " · replaced by a renewal" : ""}
              </p>
              <MandateActions clientId={clientId} mandate={row} canReview={canReview} onChanged={() => void load()} />
            </li>
          );
        })}
        {visible.length === 0 ? <li className="px-3 py-4 text-sm text-sales-text-muted">No mandates in this view.</li> : null}
      </ul>
    </div>
  );
}
