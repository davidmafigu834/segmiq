/**
 * SegmiQ Sales design tokens (TypeScript).
 * Prefer CSS variables (`--sales-*`) in components; use these for charts and non-CSS contexts.
 */

export const SALES_COLORS = {
  bg: "#EEEFE8",
  surface: "#FFFFFF",
  surfaceSubtle: "#F6F7F1",
  surfaceHover: "#E8EAE3",
  surfaceActive: "#EEF4D8",

  neutral900: "#14180F",
  neutral700: "#3D4238",
  neutral500: "#5C6156",
  neutral400: "#8A8F84",
  neutral300: "#C4C7BB",
  neutral200: "#D5D7CC",
  neutral100: "#F3F4EE",
  neutral50: "#EEEFE8",
  neutral0: "#FFFFFF",

  textPrimary: "#14180F",
  textSecondary: "#5C6156",
  textMuted: "#8A8F84",
  textDisabled: "#A8ADA2",
  textLabel: "#3D4238",

  border: "#D5D7CC",
  borderSubtle: "#E2E3DB",
  borderStrong: "#C4C7BB",

  brand: "#D4FF4F",
  brandHover: "#C6F23F",
  brandSoft: "rgba(212, 255, 79, 0.22)",
  brandSoftSolid: "#EEF4D8",
  brandBorder: "rgba(160, 205, 40, 0.4)",
  brandText: "#14180F",
  brandFg: "#4D7C0F",

  success: "#16A34A",
  successSoft: "#ECFDF3",
  warning: "#F59E0B",
  warningSoft: "#FFFAEB",
  danger: "#EF4444",
  dangerSoft: "#FEF3F2",
  info: "#2563EB",
  infoSoft: "#EFF8FF",
  purple: "#8B5CF6",
  purpleSoft: "#F4F3FF",
  teal: "#14B8A6",
  tealSoft: "#F0FDFA",

  whatsapp: "#25D366",
  facebook: "#1877F2",
} as const;

/** Dark sales palette (mirrors CSS dark overrides). Prefer CSS vars / useSalesChartColors in UI. */
export const SALES_COLORS_DARK = {
  bg: "#0B0D0C",
  bgSubtle: "#0E110E",
  sidebarBg: "#0D100E",
  surface: "#111411",
  surfaceRaised: "#151815",
  surfaceHover: "#181C18",
  surfaceSelected: "#1B2019",
  textPrimary: "#F7F8F5",
  textSecondary: "#B1B7AE",
  textMuted: "#7D847A",
  textVeryMuted: "#626961",
  border: "#272C27",
  borderSubtle: "#1E231E",
  borderStrong: "#343A34",
  brand: "#D4FF4F",
  brandSoft: "rgba(212, 255, 79, 0.10)",
  brandSelected: "rgba(212, 255, 79, 0.14)",
  success: "#4ADE80",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#60A5FA",
  purple: "#A78BFA",
  teal: "#2DD4BF",
  whatsapp: "#25D366",
} as const;

export const SALES_RADIUS = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 999,
} as const;

export const SALES_SHADOW = {
  card: "0 1px 2px rgba(28, 32, 20, 0.025)",
  dropdown: "0 4px 12px rgba(28, 32, 20, 0.08)",
  popover: "0 8px 24px rgba(28, 32, 20, 0.10)",
  modal: "0 16px 40px rgba(28, 32, 20, 0.12)",
} as const;

/** Button heights from design boards: Small 32 · Medium 40 · Large 48 */
export const SALES_BUTTON_HEIGHT = {
  sm: 32,
  md: 40,
  lg: 48,
} as const;

export const SALES_Z = {
  base: 0,
  sticky: 20,
  dropdown: 40,
  popover: 50,
  drawer: 60,
  modalBackdrop: 70,
  modal: 80,
  toast: 100,
  tooltip: 110,
} as const;

/** Chart series palette (restrained). */
export const SALES_CHART_SERIES = [
  SALES_COLORS.brand,
  SALES_COLORS.info,
  SALES_COLORS.purple,
  SALES_COLORS.warning,
  SALES_COLORS.teal,
] as const;

export const PIPELINE_STAGE_COLORS = {
  NEW: SALES_COLORS.info,
  CONTACTED: SALES_COLORS.success,
  NEGOTIATING: SALES_COLORS.warning,
  PROPOSAL_SENT: SALES_COLORS.purple,
  WON: SALES_COLORS.success,
  LOST: SALES_COLORS.danger,
  NOT_QUALIFIED: SALES_COLORS.textMuted,
} as const;
