export const MARKETING_THEME_STORAGE_KEY = "segmiq-marketing-theme";

export type MarketingTheme = "light" | "dark";

export function parseMarketingTheme(value: string | undefined | null): MarketingTheme {
  return value === "dark" ? "dark" : "light";
}

export function resolveInitialMarketingTheme(
  stored: string | undefined | null,
  prefersDark?: boolean
): MarketingTheme {
  if (stored === "dark" || stored === "light") return stored;
  if (prefersDark) return "dark";
  return "light";
}

export function persistMarketingTheme(theme: MarketingTheme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MARKETING_THEME_STORAGE_KEY, theme);
    document.cookie = `${MARKETING_THEME_STORAGE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
    // Keep CRM/sales preference in sync
    localStorage.setItem("segmiq-crm-theme", theme);
    document.cookie = `segmiq-crm-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
