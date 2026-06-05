"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { CampaignWithInsights } from "@/lib/facebook/campaigns";
import {
  type CampaignClientGroup,
  effectiveStatusLabel,
  formatCampaignBudget,
  formatCtr,
  cplColorClass,
  spendClass,
  statusPillClass,
  metaCampaignUrl,
} from "@/components/campaigns/campaign-helpers";

function CampaignRow({ c }: { c: CampaignWithInsights }) {
  const label = effectiveStatusLabel(c.effective_status, c.status);
  const ins = c.insights;

  return (
    <tr className="group border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02]">
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-medium text-ink-primary">{c.name || "—"}</span>
          <span
            className={`inline-flex w-fit rounded-full px-2.5 py-0.5 font-mono text-[11px] ${statusPillClass(label)}`}
          >
            {label}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-top font-mono text-[11px] text-ink-tertiary">
        {(c.objective ?? "—").replace(/_/g, " ")}
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-ink-secondary">
        {formatCampaignBudget(c.daily_budget as string | undefined, c.lifetime_budget as string | undefined)}
      </td>
      <td className="px-3 py-3 text-right font-mono-data text-sm tabular-nums">{ins.impressions.toLocaleString()}</td>
      <td className="px-3 py-3 text-right font-mono-data text-sm tabular-nums">{ins.clicks.toLocaleString()}</td>
      <td className="px-3 py-3 text-right font-mono-data text-sm tabular-nums">{formatCtr(ins.ctr)}</td>
      <td className={`px-3 py-3 text-right font-mono-data text-sm tabular-nums ${spendClass(ins.spend)}`}>
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
          ins.spend
        )}
      </td>
      <td className="px-3 py-3 text-right font-mono-data text-sm tabular-nums">{ins.leads}</td>
      <td className={`px-3 py-3 text-right font-mono-data text-sm tabular-nums ${cplColorClass(ins.costPerLead)}`}>
        {ins.costPerLead > 0
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
              ins.costPerLead
            )
          : "—"}
      </td>
      <td className="px-3 py-3 text-right">
        <a
          href={metaCampaignUrl(c.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink-primary"
        >
          View on Meta
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
        </a>
      </td>
    </tr>
  );
}

export function CampaignsTable({
  groups,
  facebookSettingsHref,
}: {
  groups: CampaignClientGroup[];
  facebookSettingsHref: (clientId: string) => string;
}) {
  const visible = groups.filter((g) => !g.error && g.campaigns.length > 0);
  const withErrors = groups.filter((g) => g.error);

  return (
    <div className="space-y-10">
      {withErrors.map((g) => (
        <div
          key={`err-${g.clientId}`}
          className="flex flex-col gap-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-muted)] px-4 py-3 text-sm text-[var(--warning)] sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            Unable to load campaigns for <strong>{g.clientName}</strong>: {g.error}. Check the Facebook connection.
          </p>
          <Link
            href={facebookSettingsHref(g.clientId)}
            className="shrink-0 font-medium underline underline-offset-2 hover:opacity-90"
          >
            Go to Facebook settings →
          </Link>
        </div>
      ))}

      {visible.map((g) => {
        const spend = g.campaigns.reduce((s, c) => s + c.insights.spend, 0);
        return (
          <section key={g.clientId}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <ClientAvatar name={g.clientName} size="sm" />
              <h3 className="font-display text-lg text-ink-primary">{g.clientName}</h3>
              <span className="text-sm text-ink-secondary">
                · {g.campaigns.length} campaigns ·{" "}
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                  spend
                )}
              </span>
            </div>
            <div className="mb-3 text-xs text-ink-tertiary md:hidden">Swipe for full table on larger screens.</div>
            <div className="space-y-2 md:hidden">
              {g.campaigns.map((c) => {
                const ins = c.insights;
                const label = effectiveStatusLabel(c.effective_status, c.status);
                return (
                  <a
                    key={c.id}
                    href={metaCampaignUrl(c.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-border bg-surface-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-ink-primary">{c.name || "—"}</div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10px] ${statusPillClass(label)}`}>
                        {label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-secondary">
                      <div>Spend: ${Math.round(ins.spend).toLocaleString()}</div>
                      <div className="text-right">Leads: {ins.leads}</div>
                      <div>Clicks: {ins.clicks.toLocaleString()}</div>
                      <div className="text-right">CTR: {formatCtr(ins.ctr)}</div>
                    </div>
                  </a>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    <th className="px-3 py-3 text-left font-medium">Campaign</th>
                    <th className="px-3 py-3 text-left font-medium">Objective</th>
                    <th className="px-3 py-3 text-right font-medium">Budget</th>
                    <th className="px-3 py-3 text-right font-medium">Impr.</th>
                    <th className="px-3 py-3 text-right font-medium">Clicks</th>
                    <th className="px-3 py-3 text-right font-medium">CTR</th>
                    <th className="px-3 py-3 text-right font-medium">Spend</th>
                    <th className="px-3 py-3 text-right font-medium">Leads</th>
                    <th className="px-3 py-3 text-right font-medium">CPL</th>
                    <th className="px-3 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {g.campaigns.map((c) => (
                    <CampaignRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
