"use client";

import { useEffect, useState } from "react";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { SALES_CHART_SERIES, SALES_COLORS } from "@/lib/sales/design-tokens";

export type SalesChartColors = {
  brand: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  grid: string;
  axis: string;
  surface: string;
  surfaceRaised: string;
  donutTrack: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  purple: string;
  teal: string;
  series: readonly string[];
};

const LIGHT: SalesChartColors = {
  brand: SALES_COLORS.brand,
  textPrimary: SALES_COLORS.textPrimary,
  textSecondary: SALES_COLORS.textSecondary,
  textMuted: SALES_COLORS.textMuted,
  border: SALES_COLORS.border,
  borderSubtle: SALES_COLORS.borderSubtle,
  grid: SALES_COLORS.borderSubtle,
  axis: SALES_COLORS.textMuted,
  surface: SALES_COLORS.surface,
  surfaceRaised: SALES_COLORS.surface,
  donutTrack: SALES_COLORS.neutral200,
  success: SALES_COLORS.success,
  danger: SALES_COLORS.danger,
  warning: SALES_COLORS.warning,
  info: SALES_COLORS.info,
  purple: SALES_COLORS.purple,
  teal: SALES_COLORS.teal,
  series: SALES_CHART_SERIES,
};

const DARK: SalesChartColors = {
  brand: "#D4FF4F",
  textPrimary: "#F7F8F5",
  textSecondary: "#B1B7AE",
  textMuted: "#7D847A",
  border: "#272C27",
  borderSubtle: "#1E231E",
  grid: "#202520",
  axis: "#737A71",
  surface: "#111411",
  surfaceRaised: "#181C18",
  donutTrack: "#292F29",
  success: "#4ADE80",
  danger: "#F87171",
  warning: "#FBBF24",
  info: "#60A5FA",
  purple: "#A78BFA",
  teal: "#2DD4BF",
  series: ["#D4FF4F", "#60A5FA", "#A78BFA", "#FBBF24", "#2DD4BF"],
};

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const el =
    document.querySelector(".sales-dashboard-premium") ??
    document.querySelector(".pipeline-drawer-light") ??
    document.documentElement;
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

function colorsFromCss(isDark: boolean): SalesChartColors {
  const base = isDark ? DARK : LIGHT;
  return {
    ...base,
    brand: readCssVar("--sales-brand", base.brand),
    textPrimary: readCssVar("--sales-text-primary", base.textPrimary),
    textSecondary: readCssVar("--sales-text-secondary", base.textSecondary),
    textMuted: readCssVar("--sales-text-muted", base.textMuted),
    border: readCssVar("--sales-border", base.border),
    borderSubtle: readCssVar("--sales-border-subtle", base.borderSubtle),
    grid: readCssVar("--sales-chart-grid", base.grid),
    axis: readCssVar("--sales-chart-axis", base.axis),
    surface: readCssVar("--sales-surface", base.surface),
    surfaceRaised: readCssVar("--sales-surface-raised", base.surfaceRaised),
    donutTrack: readCssVar("--sales-chart-track", base.donutTrack),
    success: readCssVar("--sales-success", base.success),
    danger: readCssVar("--sales-danger", base.danger),
    warning: readCssVar("--sales-warning", base.warning),
    info: readCssVar("--sales-info", base.info),
    purple: readCssVar("--sales-purple", base.purple),
    teal: readCssVar("--sales-teal", base.teal),
  };
}

/** Theme-aware chart colors; re-reads CSS vars when CRM theme changes. */
export function useSalesChartColors(): SalesChartColors {
  const crm = useCrmThemeOptional();
  const isDark = (crm?.theme ?? "dark") === "dark";
  const [colors, setColors] = useState<SalesChartColors>(() => (isDark ? DARK : LIGHT));

  useEffect(() => {
    setColors(colorsFromCss(isDark));
  }, [isDark]);

  return colors;
}

export { LIGHT as SALES_CHART_COLORS_LIGHT, DARK as SALES_CHART_COLORS_DARK };
