"use client";

import {
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  Inbox,
  Target,
  Trophy,
} from "lucide-react";
import { ReportKpiCard, reportKpiGridClass } from "./ReportKpiCard";
import { RevenueWonChart } from "./RevenueWonChart";
import { PipelineStageDonut } from "./PipelineStageDonut";
import { PerformanceSummary } from "./PerformanceSummary";
import { LeadsCreatedChart } from "./LeadsCreatedChart";
import { LeadConversionFunnel } from "./LeadConversionFunnel";
import { TopSalespeople } from "./TopSalespeople";
import { LeadsBySource } from "./LeadsBySource";
import { ReportFooterStrip } from "./ReportFooterStrip";
import { Skeleton } from "@/components/sales/ui";
import type { CompanyReportOverview } from "@/lib/sales/company-reports/types";
import type { ReportGranularity } from "@/lib/sales/company-reports/range";

const KPI_META = [
  { icon: CircleDollarSign, iconClass: "bg-sales-success-soft text-sales-success-fg", spark: "#22C55E" },
  { icon: Trophy, iconClass: "bg-sales-warning-soft text-sales-warning-fg", spark: "#F59E0B" },
  { icon: Inbox, iconClass: "bg-sales-purple-soft text-sales-purple-fg", spark: "#8B5CF6" },
  { icon: Target, iconClass: "bg-sales-teal-soft text-sales-teal-fg", spark: "#14B8A6" },
  { icon: BriefcaseBusiness, iconClass: "bg-sales-warning-soft text-sales-warning-fg", spark: "#22C55E" },
  { icon: Clock3, iconClass: "bg-sales-info-soft text-sales-info-fg", spark: "#3B82F6" },
] as const;

export function ReportOverview({
  data,
  granularity,
  pipelineMode,
  onGranularity,
  onPipelineMode,
  onRefresh,
  refreshing,
  lastUpdated,
  onOpenTeam,
  onOpenLeads,
  onOpenPipeline,
  onRetry,
}: {
  data: CompanyReportOverview;
  granularity: ReportGranularity;
  pipelineMode: "count" | "value";
  onGranularity: (value: ReportGranularity) => void;
  onPipelineMode: (mode: "count" | "value") => void;
  onRefresh: () => void;
  refreshing?: boolean;
  lastUpdated: Date | null;
  onOpenTeam: () => void;
  onOpenLeads: () => void;
  onOpenPipeline: (stage?: string) => void;
  onRetry: () => void;
}) {
  const scopeNote = data.filters.ownerName ? `Company scope: ${data.filters.ownerName}` : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
      <section className={reportKpiGridClass(data.kpis.length)}>
        {data.kpis.map((item, i) => {
          const meta = KPI_META[i] ?? KPI_META[0]!;
          return (
            <ReportKpiCard
              key={item.id}
              label={item.label}
              value={item.value}
              trend={item.trend}
              icon={meta.icon}
              iconClass={meta.iconClass}
              sparkline={item.sparkline}
              sparkColor={meta.spark}
              tip={item.tip}
            />
          );
        })}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="h-[280px] min-w-0 overflow-hidden layout:h-[320px]">
            <RevenueWonChart
              series={data.revenueSeries}
              currency={data.currency}
              granularity={granularity}
              onGranularity={onGranularity}
              error={data.errors.revenue}
              onRetry={onRetry}
            />
          </div>
          <div className="h-[260px] min-w-0 overflow-hidden layout:h-[300px]">
            <LeadsCreatedChart
              series={data.leadSeries}
              granularity={granularity}
              onGranularity={onGranularity}
              error={data.errors.leads}
              onRetry={onRetry}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="h-[280px] min-w-0 overflow-hidden layout:h-[320px]">
            <PipelineStageDonut
              slices={data.pipeline.slices}
              activeCount={data.pipeline.activeCount}
              currency={data.currency}
              mode={pipelineMode}
              onMode={onPipelineMode}
              error={data.errors.pipeline}
              onRetry={onRetry}
              onStageClick={(stage) => onOpenPipeline(stage)}
            />
          </div>
          <div className="h-[260px] min-w-0 overflow-hidden layout:h-[300px]">
            <LeadConversionFunnel
              stages={data.funnel.stages}
              methodology={data.funnel.methodology}
              error={data.errors.funnel}
              onRetry={onRetry}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PerformanceSummary rows={data.performanceSummary} />
          <TopSalespeople
            rows={data.topSalespeople}
            currency={data.currency}
            onViewAll={onOpenTeam}
            onSelect={() => onOpenTeam()}
          />
          <LeadsBySource
            rows={data.leadSources.rows}
            total={data.leadSources.total}
            onViewAll={onOpenLeads}
          />
        </div>
      </div>

      <ReportFooterStrip
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        refreshing={refreshing}
        scopeNote={scopeNote}
      />
    </div>
  );
}

export function ReportOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading reports">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] layout:grid-cols-[repeat(6,minmax(0,1fr))]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[142px] rounded-[12px]" />
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-[280px] rounded-[12px] layout:h-[320px]" />
          <Skeleton className="h-[260px] rounded-[12px] layout:h-[300px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-[280px] rounded-[12px] layout:h-[320px]" />
          <Skeleton className="h-[260px] rounded-[12px] layout:h-[300px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-[140px] rounded-[12px]" />
          <Skeleton className="h-[160px] rounded-[12px]" />
          <Skeleton className="h-[160px] rounded-[12px]" />
        </div>
      </div>
    </div>
  );
}
