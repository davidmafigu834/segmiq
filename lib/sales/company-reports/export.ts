import type { CompanyReportPayload } from "./types";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCompanyReportCsv(payload: CompanyReportPayload): string {
  const lines: string[] = [];
  lines.push(`SegmiQ Company Reports`);
  lines.push(`Tab,${payload.tab}`);
  lines.push(`Range,${payload.range.label}`);
  lines.push(`From,${payload.range.from}`);
  lines.push(`To,${payload.range.to}`);
  lines.push(`Previous,${payload.range.previousLabel}`);
  if (payload.filters.ownerName) lines.push(`Salesperson,${payload.filters.ownerName}`);
  lines.push("");

  if ("kpis" in payload && payload.kpis) {
    lines.push("KPI,Value,Trend");
    for (const k of payload.kpis) {
      lines.push([csvEscape(k.label), csvEscape(k.value), csvEscape(k.trend.label)].join(","));
    }
    lines.push("");
  }

  if (payload.tab === "overview") {
    lines.push("Revenue Won over time");
    lines.push("Date,This period,Previous period");
    for (const p of payload.revenueSeries) {
      lines.push([p.label, p.current, p.previous].join(","));
    }
    lines.push("");
    lines.push("Active Deals by stage");
    lines.push("Stage,Count,Value,Percent");
    for (const s of payload.pipeline.slices) {
      lines.push([csvEscape(s.label), s.count, s.value, `${s.pct}%`].join(","));
    }
    lines.push("");
    lines.push("Performance summary");
    for (const row of payload.performanceSummary) {
      lines.push([csvEscape(row.label), csvEscape(row.value), csvEscape(row.trend.label)].join(","));
    }
    lines.push("");
    lines.push("Lead conversion funnel (cohort)");
    lines.push("Stage,Count,Conversion");
    for (const s of payload.funnel.stages) {
      lines.push([csvEscape(s.label), s.count, `${s.conversionPct}%`].join(","));
    }
    lines.push("");
    lines.push("Top salespeople by Revenue Won");
    lines.push("Name,Revenue Won,Deals Won");
    for (const s of payload.topSalespeople) {
      lines.push([csvEscape(s.name), s.revenueWon, s.dealsWon].join(","));
    }
    lines.push("");
    lines.push("Leads by source");
    lines.push("Source,Count,Percent");
    for (const s of payload.leadSources.rows) {
      lines.push([csvEscape(s.label), s.count, `${s.pct}%`].join(","));
    }
  }

  if (payload.tab === "team") {
    lines.push("Salesperson,Revenue Won,Deals Won,Pipeline Value,New Leads");
    for (const row of payload.rows) {
      lines.push(
        [csvEscape(row.name), row.revenueWon, row.dealsWon, row.pipelineValue, row.newLeads].join(",")
      );
    }
  }

  if (payload.tab === "sales") {
    lines.push("Salesperson,Revenue Won,Deals Won");
    for (const row of payload.bySalesperson) {
      lines.push([csvEscape(row.name), row.revenueWon, row.dealsWon].join(","));
    }
  }

  return lines.join("\n");
}

export function companyReportExportFilename(payload: CompanyReportPayload): string {
  const day = payload.generatedAt.slice(0, 10);
  return `segmiq-reports-${payload.tab}-${day}.csv`;
}
