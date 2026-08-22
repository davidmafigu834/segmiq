"use client";

import type { ReactNode } from "react";
import { ReportKpiCard, reportKpiGridClass } from "./ReportKpiCard";
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
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
      {data.tab === "sales" ? (
        <>
          <KpiGrid data={data} />
          <div className="h-[280px] min-w-0 overflow-hidden layout:h-[320px]">
            <RevenueWonChart
              series={data.revenueSeries}
              currency={data.currency}
              granularity={granularity}
              onGranularity={onGranularity}
            />
          </div>
          <ReportChartCard
            title="Revenue Won by salesperson"
            hint="Deal win rate is Won / (Won + Lost) for Deals closed in this period — not Lead → Deal conversion."
          >
            {data.bySalesperson.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">
                No Won Deal results in this period.
              </p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.bySalesperson.map((row) => (
                  <MetricRow
                    key={row.userId}
                    label={row.name}
                    value={`${formatDealCurrency(row.revenueWon, { currency: data.currency })} · ${row.dealsWon}`}
                    leading={<Avatar name={row.name} src={row.avatarUrl} size="sm" />}
                  />
                ))}
              </ul>
            )}
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "pipeline" ? (
        <>
          <KpiGrid data={data} />
          <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.4fr)_minmax(0,20rem)]">
            <div className="h-[280px] min-w-0 overflow-hidden layout:h-[320px]">
              <PipelineStageDonut
                slices={data.pipeline.slices}
                activeCount={data.pipeline.activeCount}
                currency={data.currency}
                mode={pipelineMode}
                onMode={onPipelineMode}
              />
            </div>
            <div className="min-h-[160px] min-w-0 layout:h-[320px]">
              <ReportChartCard title="Pipeline health">
                <p className="text-[28px] font-semibold tabular-nums leading-none text-sales-text-primary">
                  {data.noNextAction}
                </p>
                <p className="mt-2 text-[13px] leading-snug text-sales-text-secondary">
                  Active Deal{data.noNextAction === 1 ? "" : "s"} with no next action scheduled.
                </p>
                <p className="mt-4 text-[11px] leading-relaxed text-sales-text-muted">
                  Won and Lost Deals are not included in the stage chart.
                </p>
              </ReportChartCard>
            </div>
          </div>
        </>
      ) : null}

      {data.tab === "leads" ? (
        <>
          <KpiGrid data={data} />
          <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-2">
            <div className="h-[260px] min-w-0 overflow-hidden layout:h-[300px]">
              <LeadsCreatedChart
                series={data.leadSeries}
                granularity={granularity}
                onGranularity={onGranularity}
              />
            </div>
            <div className="h-[260px] min-w-0 overflow-hidden layout:h-[300px]">
              <LeadConversionFunnel stages={data.funnel.stages} methodology={data.funnel.methodology} />
            </div>
          </div>
          <LeadsBySource rows={data.leadSources.rows} total={data.leadSources.total} />
        </>
      ) : null}

      {data.tab === "whatsapp" ? (
        <>
          <KpiGrid data={data} />
          <div className="grid min-w-0 grid-cols-[repeat(1,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            <Stat label="Inbound messages" value={String(data.inbound)} />
            <Stat label="Outbound messages" value={String(data.outbound)} />
            <Stat label="Needs reply" value={String(data.awaitingReply)} />
          </div>
          <ReportChartCard
            title="By owner"
            hint="WhatsApp source means the Lead originated from WhatsApp. Messages sent are not sales success."
          >
            {data.byRep.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">
                No WhatsApp activity in this period.
              </p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.byRep.map((row) => (
                  <MetricRow
                    key={row.userId}
                    label={row.name}
                    value={`${row.assignedChats} chats · ${row.outboundMessages} sent`}
                  />
                ))}
              </ul>
            )}
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "quotations" ? (
        <>
          <KpiGrid data={data} />
          <ReportChartCard
            title="Quotes by status"
            hint="Quoted value is not Revenue Won. Accepted quotes do not mark Deals Won."
          >
            {data.byStatus.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">No quotations in this period.</p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {data.byStatus.map((row) => (
                  <MetricRow key={row.status} label={row.label} value={String(row.count)} />
                ))}
              </ul>
            )}
          </ReportChartCard>
          <ReportChartCard
            title="By salesperson"
            hint="Accepted quotation value is not salesperson revenue."
          >
            {(data.bySalesperson ?? []).length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">No quotations in this period.</p>
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {(data.bySalesperson ?? []).map((row) => (
                  <MetricRow
                    key={row.userId}
                    label={row.name}
                    value={`${row.created} created · ${row.accepted} accepted`}
                  />
                ))}
              </ul>
            )}
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "team" ? (
        <ReportChartCard
          title="Team results"
          hint="Ranked by Revenue Won. Activity volume is not used as a performance ranking."
        >
          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-sales-text-muted">No team members in scope.</p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[36rem] table-fixed text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] text-sales-text-muted">
                    <th className="w-[32%] pb-2 font-medium">Salesperson</th>
                    <th className="w-[17%] pb-2 text-right font-medium">Revenue Won</th>
                    <th className="w-[17%] pb-2 text-right font-medium">Deals Won</th>
                    <th className="w-[17%] pb-2 text-right font-medium">Pipeline</th>
                    <th className="w-[17%] pb-2 text-right font-medium">New Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.userId} className="border-t border-sales-border-subtle">
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex min-w-0 max-w-full items-center gap-2">
                          <Avatar name={row.name} src={row.avatarUrl} size="xs" />
                          <span className="truncate">{row.name}</span>
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
                  <MetricRow
                    key={row.contactId}
                    label={row.name}
                    value={`${formatDealCurrency(row.revenueWon, { currency: data.currency })} · ${row.dealsWon}`}
                  />
                ))}
              </ul>
            )}
          </ReportChartCard>
        </>
      ) : null}

      {data.tab === "activities" ? (
        <>
          <KpiGrid data={data} />
          <ReportChartCard
            title="Activity mix"
            hint="Activity counts measure execution, not sales quality. People are not ranked by volume alone."
          >
            <ul className="divide-y divide-sales-border-subtle">
              {data.byType.map((row) => (
                <MetricRow key={row.type} label={row.label} value={String(row.count)} />
              ))}
            </ul>
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
    <section className={reportKpiGridClass(data.kpis.length)}>
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

function MetricRow({
  label,
  value,
  leading,
}: {
  label: string;
  value: string;
  leading?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center justify-between gap-3 py-2.5">
      <span className="inline-flex min-w-0 items-center gap-2">
        {leading ? <span className="shrink-0">{leading}</span> : null}
        <span className="truncate text-[13px] text-sales-text-primary" title={label}>
          {label}
        </span>
      </span>
      <span className="shrink-0 text-[13px] tabular-nums text-sales-text-secondary">{value}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface p-4">
      <p className="truncate text-[12px] text-sales-text-secondary">{label}</p>
      <p className="mt-2 truncate text-[22px] font-semibold tabular-nums text-sales-text-primary">{value}</p>
    </div>
  );
}
