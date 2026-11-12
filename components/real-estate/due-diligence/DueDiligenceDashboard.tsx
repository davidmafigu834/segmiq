"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/sales/ui/Button";
import { ReEmptyState, ReErrorState, RePageHeader, ReSection, ReSkeletonRows, ReStatusBadge } from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import { REPORT_STATUS_LABEL, TENURE_LABEL, type ReportStatus, type TenureType } from "@/lib/real-estate/due-diligence/types";
import type { BadgeTone } from "@/components/sales/ui/Badge";

export type DueDiligenceListRow = {
  id: string;
  reference: string;
  status: string;
  report_status: ReportStatus | null;
  risk_score: number | null;
  created_at: string;
  updated_at: string;
  re_dd_sellers: { full_name: string } | { full_name: string }[] | null;
  re_dd_properties:
    | { address: string; stand_number: string; suburb: string; city: string; tenure_type: TenureType }
    | { address: string; stand_number: string; suburb: string; city: string; tenure_type: TenureType }[]
    | null;
};

type MandateListRow = DueDiligenceListRow;

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toneFor(status: string | null): BadgeTone {
  if (status === "pass" || status === "cleared") return "success";
  if (status === "fail" || status === "rejected") return "danger";
  if (status === "conditional_pass" || status === "processing") return "warning";
  return "neutral";
}

function statusLabel(row: MandateListRow): string {
  if (row.status === "cleared") return "Manually approved";
  if (row.status === "rejected") return "Rejected";
  if (row.report_status) return REPORT_STATUS_LABEL[row.report_status];
  return "Pending";
}

function statusKey(row: MandateListRow): string {
  if (row.status === "cleared" || row.status === "rejected") return row.status;
  return row.report_status ?? "pending";
}

function withinDays(iso: string, days: number): boolean {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

export function DueDiligenceDashboard({
  clientId,
  basePath,
  framed = false,
  sampleRows,
  onOpen,
}: {
  clientId: string;
  basePath: string;
  framed?: boolean;
  sampleRows?: MandateListRow[];
  onOpen?: (id: string) => void;
}) {
  const [rows, setRows] = useState<MandateListRow[]>(sampleRows ?? []);
  const [state, setState] = useState<"loading" | "ready" | "error" | "disabled">(sampleRows ? "ready" : "loading");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");

  useEffect(() => {
    if (sampleRows) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/clients/${clientId}/due-diligence`, { cache: "no-store" });
      if (cancelled) return;
      if (response.status === 404) {
        setState("disabled");
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not load mandates.");
        setState("error");
        return;
      }
      setRows(body?.mandates ?? []);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, sampleRows]);

  const visible = useMemo(() => rows.filter((row) => {
    if (statusFilter !== "all" && statusKey(row) !== statusFilter) return false;
    const opened = row.created_at || row.updated_at;
    if (dateFilter === "7" && !withinDays(opened, 7)) return false;
    if (dateFilter === "30" && !withinDays(opened, 30)) return false;
    if (dateFilter === "90" && !withinDays(opened, 90)) return false;
    const score = row.risk_score;
    if (scoreFilter === "strong" && (score == null || score < 80)) return false;
    if (scoreFilter === "open" && (score == null || score < 50 || score >= 80)) return false;
    if (scoreFilter === "weak" && (score == null || score >= 50)) return false;
    if (scoreFilter === "unscored" && score != null) return false;
    return true;
  }), [rows, statusFilter, dateFilter, scoreFilter]);

  return (
    <div className={framed ? reEmbeddedShell : reSalesShell}>
      <RePageHeader
        title="Due diligence"
        description="Check a seller's identity and documents before the property is marketed."
        actions={
          state === "ready" && !sampleRows ? (
            <Link href={`${basePath}/new`} className="inline-flex">
              <Button type="button">New mandate</Button>
            </Link>
          ) : null
        }
      />
      {state === "disabled" ? (
        <ReEmptyState
          framed
          title="Due diligence is switched off"
          description="An administrator turns it on after the database migration is applied."
        />
      ) : null}
      {state === "loading" ? <ReSkeletonRows rows={4} label="Loading mandates" /> : null}
      {state === "error" ? <ReErrorState title="Could not load mandates" description={error} /> : null}
      {state === "ready" && rows.length === 0 ? (
        <ReEmptyState
          framed
          icon={<ShieldCheck />}
          title="No mandates yet"
          description="Open a mandate when a seller is ready to be checked."
          action={<Link href={`${basePath}/new`} className="inline-flex"><Button type="button">New mandate</Button></Link>}
        />
      ) : null}
      {state === "ready" && rows.length > 0 ? (
        <ReSection id="due-diligence-mandates" title="Mandates" count={visible.length} flush>
          <div className="grid gap-3 border-b border-sales-border-subtle px-3 py-3 sm:grid-cols-3">
            <label>
              <span className={acqLabelClass}>Status</span>
              <select className={acqFieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="conditional_pass">Conditional pass</option>
                <option value="fail">Fail</option>
                <option value="cleared">Manually approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label>
              <span className={acqLabelClass}>Opened</span>
              <select className={acqFieldClass} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                <option value="all">Any date</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <label>
              <span className={acqLabelClass}>Score</span>
              <select className={acqFieldClass} value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)}>
                <option value="all">Any score</option>
                <option value="strong">80–100</option>
                <option value="open">50–79</option>
                <option value="weak">Below 50</option>
                <option value="unscored">Not scored</option>
              </select>
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-sales-text-secondary">No mandates match these filters.</p>
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {visible.map((row) => {
                const seller = first(row.re_dd_sellers);
                const property = first(row.re_dd_properties);
                const place = property?.address
                  ? property.address
                  : property
                    ? `Stand ${property.stand_number}, ${property.suburb}`
                    : "Property not recorded";
                const opened = row.created_at || row.updated_at;
                return (
                  <li key={row.id}>
                    {onOpen ? (
                  <button type="button" onClick={() => onOpen(row.id)} className="re-focus flex min-h-11 w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-sales-surface-hover">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-sales-text-primary">{seller?.full_name || row.reference}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-sales-text-secondary">
                          {place}
                          {property ? ` · ${TENURE_LABEL[property.tenure_type]}` : ""}
                          {row.risk_score != null ? ` · Score ${row.risk_score}` : ""}
                          {opened ? ` · ${new Date(opened).toLocaleDateString()}` : ""}
                        </span>
                      </span>
                    <ReStatusBadge label={statusLabel(row)} tone={toneFor(row.report_status ?? row.status)} />
                  </button>
                  ) : (
                  <Link href={`${basePath}/${row.id}`} className="re-focus flex min-h-11 items-center justify-between gap-3 px-3 py-3 hover:bg-sales-surface-hover">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-sales-text-primary">{seller?.full_name || row.reference}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-sales-text-secondary">
                        {place}
                        {property ? ` · ${TENURE_LABEL[property.tenure_type]}` : ""}
                        {row.risk_score != null ? ` · Score ${row.risk_score}` : ""}
                        {opened ? ` · ${new Date(opened).toLocaleDateString()}` : ""}
                      </span>
                    </span>
                    <ReStatusBadge label={statusLabel(row)} tone={toneFor(row.report_status ?? row.status)} />
                  </Link>
                  )}
                  </li>
                );
              })}
            </ul>
          )}
        </ReSection>
      ) : null}
    </div>
  );
}
