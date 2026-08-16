"use client";

import { ReportKpiCard } from "./ReportKpiCard";
import { ReportChartCard } from "./ReportChartCard";
import { RevenueWonChart } from "./RevenueWonChart";
import { PipelineStageDonut } from "./PipelineStageDonut";
import { LeadsCreatedChart } from "./LeadsCreatedChart";
import { LeadConversionFunnel } from "./LeadConversionFunnel";
import { LeadsBySource } from "./LeadsBySource";
import { ReportFooterStrip } from "./ReportFooterStrip";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  Inbox,
  MessageCircle,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { formatDealCurrency } from "@/lib/sales/format";
import type { CompanyReportPayload } from "@/lib/sales/company-reports/types";
import type { ReportGranularity } from "@/lib/sales/company-reports/range";
import { Avatar } from "@/components/sales/ui";

export function ReportTabView({
  data,
  granularity,
  pipelineMode,
  onGranularity,
  onPipelineMode,
  lastUpdated,
  onRefresh,
  refreshing,
}: {
  data: Exclude<CompanyReportPayload, { tab: "overview" }>;
  granularity: ReportGranularity;
  pipelineMode: "count" | "value";
  onGranularity: (value: ReportGranularity) => void;
  onPipelineMode: (mode: "count" | "value") => void;
  lastUpdated: Date | null;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {data.tab === "sales" ? (
        <>
          <KpiGrid data={data} />
          <RevenueWonChart
            series={data.revenueSeries}
            currency={data.currency}
            granularity={granularity}
            onGranularity={onGranularity}
          />
          <ReportChartCard title="Revenue Won by salesperson">
            {data.bySalesperson.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">
                No Won Deal results in this period.
              </p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.bySalesperson.map((row) => (
                  <li key={row.userId} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                      <span className="truncate text-[13px] text-sales-text-primary">{row.name}</span>
                    </span>
                    <span className="text-[13px] tabular-nums text-sales-text-primary">
                      {formatDealCurrency(row.revenueWon, { currency: data.currency })} · {row.dealsWon}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-sales-text-muted">
              Deal win rate is Won / (Won + Lost) for Deals closed in this period — not Lead → Deal conversion.
            </p>
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "pipeline" ? (
        <>
          <KpiGrid data={data} />
          <PipelineStageDonut
            slices={data.pipeline.slices}
            activeCount={data.pipeline.activeCount}
            currency={data.currency}
            mode={pipelineMode}
            onMode={onPipelineMode}
          />
          <p className="text-[12px] text-sales-text-muted">
            {data.noNextAction} active Deal{data.noNextAction === 1 ? "" : "s"} with no next action scheduled.
          </p>
        </>
      ) : null}

      {data.tab === "leads" ? (
        <>
          <KpiGrid data={data} />
          <div className="grid grid-cols-1 gap-4 layout:grid-cols-2">
            <LeadsCreatedChart
              series={data.leadSeries}
              granularity={granularity}
              onGranularity={onGranularity}
            />
            <LeadConversionFunnel stages={data.funnel.stages} methodology={data.funnel.methodology} />
          </div>
          <LeadsBySource rows={data.leadSources.rows} total={data.leadSources.total} onViewAll={() => undefined} />
        </>
      ) : null}

      {data.tab === "whatsapp" ? (
        <>
          <KpiGrid data={data} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Stat label="Inbound messages" value={String(data.inbound)} />
            <Stat label="Outbound messages" value={String(data.outbound)} />
            <Stat label="Needs reply" value={String(data.awaitingReply)} />
          </div>
          <ReportChartCard title="By owner">
            {data.byRep.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">No WhatsApp activity in this period.</p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.byRep.map((row) => (
                  <li key={row.userId} className="flex justify-between py-2.5 text-[13px]">
                    <span>{row.name}</span>
                    <span className="tabular-nums text-sales-text-secondary">
                      {row.assignedChats} chats · {row.outboundMessages} sent
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-sales-text-muted">
              WhatsApp source means the Lead originated from WhatsApp. Messages sent are not sales success.
            </p>
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "quotations" ? (
        <>
          <KpiGrid data={data} />
          <ReportChartCard title="Quotes by status">
            {data.byStatus.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">No quotations in this period.</p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.byStatus.map((row) => (
                  <li key={row.status} className="flex justify-between py-2.5 text-[13px]">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-sales-text-muted">
              Quoted value is not Revenue Won. Accepted quotes do not mark Deals Won.
            </p>
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "team" ? (
        <ReportChartCard title="Team results">
          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-sales-text-muted">No team members in scope.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] text-sales-text-muted">
                    <th className="pb-2 font-medium">Salesperson</th>
                    <th className="pb-2 text-right font-medium">Revenue Won</th>
                    <th className="pb-2 text-right font-medium">Deals Won</th>
                    <th className="pb-2 text-right font-medium">Pipeline</th>
                    <th className="pb-2 text-right font-medium">New Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.userId} className="border-t border-sales-border-subtle">
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={row.name} src={row.avatarUrl} size="xs" />
                          {row.name}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatDealCurrency(row.revenueWon, { currency: data.currency })}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{row.dealsWon}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatDealCurrency(row.pipelineValue, { currency: data.currency })}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{row.newLeads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-sales-text-muted">
            Ranked by Revenue Won. Activity volume is not used as a performance ranking.
          </p>
        </ReportChartCard>
      ) : null}

      {data.tab === "customers" ? (
        <>
          <KpiGrid data={data} />
          <ReportChartCard title="Won value by customer">
            {data.topCustomers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">
                No Won Deals with customers in this period.
              </p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.topCustomers.map((row) => (
                  <li key={row.contactId} className="flex justify-between py-2.5 text-[13px]">
                    <span className="truncate">{row.name}</span>
                    <span className="tabular-nums">
                      {formatDealCurrency(row.revenueWon, { currency: data.currency })} · {row.dealsWon}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "activities" ? (
        <>
          <KpiGrid data={data} />
          <ReportChartCard title="Activity mix">
            <ul className="divide-y divide-sales-border-subtle">
              {data.byType.map((row) => (
                <li key={row.type} className="flex justify-between py-2.5 text-[13px]">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-sales-text-muted">
              Activity counts measure execution, not sales quality. People are not ranked by volume alone.
            </p>
          </ReportChartCard>
        </>
      ) : null}

      <ReportFooterStrip lastUpdated={lastUpdated} onRefresh={onRefresh} refreshing={refreshing} />
    </div>
  );
}

function KpiGrid({ data }: { data: CompanyReportPayload }) {
  if (!("kpis" in data) || !data.kpis?.length) return null;
  const icons = [CircleDollarSign, Trophy, Inbox, Target, BriefcaseBusiness, Clock3, MessageCircle, Users];
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 layout:grid-cols-6">
      {data.kpis.map((item, i) => {
        const Icon = icons[i] ?? Inbox;
        return (
          <ReportKpiCard
            key={item.id}
            label={item.label}
            value={item.value}
            trend={item.trend}
            icon={Icon}
            iconClass="bg-sales-neutral-100 text-sales-text-secondary"
            sparkline={item.sparkline}
            sparkColor="#D4FF4F"
            tip={item.tip}
          />
        );
      })}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-sales-border bg-sales-surface p-4">
      <p className="text-[12px] text-sales-text-secondary">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tabular-nums text-sales-text-primary">{value}</p>
    </div>
  );
}
