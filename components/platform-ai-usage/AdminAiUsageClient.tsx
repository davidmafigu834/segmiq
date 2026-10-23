"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { UsageMeter } from "./UsageMeter";
import type { AiUsageOverview } from "@/lib/platform-ai-usage/types";
import { Bot, MessageSquare, ShieldAlert } from "lucide-react";
import { CommercialEmptyState, CommercialMetric, CommercialStatus } from "@/components/commercial/CommercialPrimitives";

export function AdminAiUsageClient({ rows }: { rows: AiUsageOverview[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter(
      (row) =>
        (status === "all" || row.status === status) &&
        (!term || row.companyName.toLocaleLowerCase().includes(term)),
    );
  }, [rows, search, status]);
  const summary = useMemo(() => ({
    subscribed: rows.filter((row) => Boolean(row.aiSku)).length,
    shadow: rows.filter((row) => row.status === "shadow").length,
    exhausted: rows.filter((row) => row.conversations?.available === 0 || row.actions?.available === 0).length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid border-y border-[var(--border)] sm:grid-cols-3">
        <CommercialMetric icon={Bot} label="Agentic AI subscriptions" value={summary.subscribed.toLocaleString()} detail="Business and Scale packages" />
        <CommercialMetric icon={MessageSquare} label="Shadow-metered accounts" value={summary.shadow.toLocaleString()} detail="Observation only; no overage charge" />
        <CommercialMetric icon={ShieldAlert} label="Quota exhausted" value={summary.exhausted.toLocaleString()} detail="Requires an explicit customer-approved next step" />
      </div>
      <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-[var(--text-secondary)]">
          <span>Search company</span>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Company name"
          />
        </label>
        <label className="space-y-1 text-sm text-[var(--text-secondary)]">
          <span>Commercial status</span>
          <select
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 text-[var(--text-primary)]"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="shadow">Shadow</option>
            <option value="enforced">Enforced</option>
            <option value="unmetered_legacy">Unmetered legacy</option>
            <option value="no_signed_agreement">No signed agreement</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>
      <p
        role="status"
        aria-atomic="true"
        className="text-sm text-[var(--text-secondary)]"
      >
        {visible.length} {visible.length === 1 ? "company" : "companies"}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((row) => (
          <article
            key={row.clientId}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)]">
                  {row.companyName}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {row.aiSku?.replaceAll("_", " ") ?? "No Agentic package"}
                </p>
              </div>
              <CommercialStatus value={row.status} />
            </div>
            {row.conversations && row.actions ? (
              <div className="mt-5 space-y-5">
                <UsageMeter
                  label="Customer conversations"
                  metric={row.conversations}
                />
                <UsageMeter label="Internal AI actions" metric={row.actions} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                No contracted v2 usage period. Operational history is not
                billed.
              </p>
            )}
            <p className="mt-4 text-xs text-[var(--text-tertiary)]">
              Last measured:{" "}
              {row.lastMeasuredAt
                ? new Date(row.lastMeasuredAt).toLocaleString()
                : "Never"}
            </p>
          </article>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"><CommercialEmptyState icon={Bot} title={rows.length ? "No companies match" : "No AI usage records"} description={rows.length ? "Change the company search or commercial status filter." : "Usage appears only for a contracted v2 billing period; legacy operational activity is not billed."} /></div>
      ) : null}
    </div>
  );
}
