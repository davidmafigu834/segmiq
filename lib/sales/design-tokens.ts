/**
 * SegmiQ Sales design tokens (TypeScript).
 * Prefer CSS variables (`--sales-*`) in components; use these for charts and non-CSS contexts.
 */

export const SALES_COLORS = {
  bg: "#F7F8FC",
  surface: "#FFFFFF",
  surfaceSubtle: "#F5F7FC",
  surfaceHover: "#EEF1F8",
  surfaceActive: "#E8EDF8",

  neutral900: "#101828",
  neutral700: "#344054",
  neutral500: "#475467",
  neutral400: "#667085",
  neutral300: "#D0D5DD",
  neutral200: "#E4E7EC",
  neutral100: "#F4F6FB",
  neutral50: "#F7F8FC",
  neutral0: "#FFFFFF",

  textPrimary: "#101828",
  textSecondary: "#475467",
  textMuted: "#667085",
  textDisabled: "#98A2B3",
  textLabel: "#344054",

  border: "#E2E8F0",
  borderSubtle: "#EEF1F6",
  borderStrong: "#D0D7E4",

  brand: "#D4FF4F",
  brandHover: "#C6F23F",
  brandSoft: "rgba(212, 255, 79, 0.22)",
  brandSoftSolid: "#EEF4D8",
  brandBorder: "rgba(160, 205, 40, 0.4)",
  brandText: "#101828",
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
  bg: "#050F22",
  bgSubtle: "#040D1D",
  sidebarBg: "#030C1C",
  surface: "#081831",
  surfaceRaised: "#10264C",
  surfaceHover: "#12264C",
  surfaceSelected: "#173056",
  textPrimary: "#F7F9FC",
  textSecondary: "#A8B5D0",
  textMuted: "#7182A7",
  textVeryMuted: "#5E6E93",
  border: "rgba(126, 150, 205, 0.20)",
  borderSubtle: "rgba(126, 150, 205, 0.11)",
  borderStrong: "rgba(126, 150, 205, 0.28)",
  brand: "#D4FF4F",
  brandSoft: "rgba(212, 255, 79, 0.10)",
  brandSelected: "rgba(212, 255, 79, 0.14)",
  success: "#3DDC97",
  warning: "#F5B82E",
  danger: "#FF5D73",
  info: "#4D8DFF",
  purple: "#9366FF",
  teal: "#20D4D2",
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
  card: "0 1px 2px rgba(16, 24, 64, 0.025)",
  dropdown: "0 4px 12px rgba(16, 24, 64, 0.08)",
  popover: "0 8px 24px rgba(16, 24, 64, 0.10)",
  modal: "0 16px 40px rgba(16, 24, 64, 0.12)",
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
