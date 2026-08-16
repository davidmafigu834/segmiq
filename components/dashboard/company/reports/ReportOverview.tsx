"use client";

import {
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  Inbox,
  Target,
  Trophy,
} from "lucide-react";
import { ReportKpiCard } from "./ReportKpiCard";
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
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 layout:grid-cols-6">
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

      <div className="flex flex-col gap-4 layout:grid layout:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(360px,28%)] layout:grid-rows-[minmax(275px,1fr)_minmax(250px,1fr)] layout:gap-4">
        <div className="order-1 min-h-0 layout:col-start-1 layout:row-start-1">
          <RevenueWonChart
            series={data.revenueSeries}
            currency={data.currency}
            granularity={granularity}
            onGranularity={onGranularity}
            error={data.errors.revenue}
            onRetry={onRetry}
          />
        </div>
        <div className="order-3 min-h-0 layout:col-start-2 layout:row-start-1">
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
        <div className="order-4 min-h-0 layout:col-start-1 layout:row-start-2">
          <LeadsCreatedChart
            series={data.leadSeries}
            granularity={granularity}
            onGranularity={onGranularity}
            error={data.errors.leads}
            onRetry={onRetry}
          />
        </div>
        <div className="order-5 min-h-0 layout:col-start-2 layout:row-start-2">
          <LeadConversionFunnel
            stages={data.funnel.stages}
            methodology={data.funnel.methodology}
            error={data.errors.funnel}
            onRetry={onRetry}
          />
        </div>
        <div className="contents layout:col-start-3 layout:row-span-2 layout:row-start-1 layout:flex layout:min-h-0 layout:flex-col layout:gap-4">
          <div className="order-2 min-h-0 layout:order-none">
            <PerformanceSummary rows={data.performanceSummary} />
          </div>
          <div className="order-6 min-h-0 layout:order-none layout:flex-1">
            <TopSalespeople
              rows={data.topSalespeople}
              currency={data.currency}
              onViewAll={onOpenTeam}
              onSelect={() => onOpenTeam()}
            />
          </div>
          <div className="order-7 min-h-0 layout:order-none layout:flex-1">
            <LeadsBySource
              rows={data.leadSources.rows}
              total={data.leadSources.total}
              onViewAll={onOpenLeads}
            />
          </div>
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 layout:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[142px] rounded-[12px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(360px,28%)]">
        <Skeleton className="h-[280px] rounded-[12px]" />
        <Skeleton className="h-[280px] rounded-[12px]" />
        <div className="space-y-4">
          <Skeleton className="h-[140px] rounded-[12px]" />
          <Skeleton className="h-[160px] rounded-[12px]" />
          <Skeleton className="h-[160px] rounded-[12px]" />
        </div>
      </div>
    </div>
  );
}
