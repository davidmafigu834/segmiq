export const CRM_THEME_STORAGE_KEY = "segmiq-crm-theme";

export type CrmTheme = "light" | "dark";

export function parseCrmTheme(value: string | undefined | null): CrmTheme {
  return value === "light" ? "light" : "dark";
}

export function readStoredCrmTheme(): CrmTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const crm = localStorage.getItem(CRM_THEME_STORAGE_KEY);
    if (crm === "light" || crm === "dark") return crm;
    // Align with marketing/auth preference when CRM has never been set
    const marketing = localStorage.getItem("segmiq-marketing-theme");
    if (marketing === "light" || marketing === "dark") return marketing;
    return "dark";
  } catch {
    return "dark";
  }
}

export function persistCrmTheme(theme: CrmTheme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CRM_THEME_STORAGE_KEY, theme);
    document.cookie = `${CRM_THEME_STORAGE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
    // Keep landing/auth preference in sync so theme feels continuous
    localStorage.setItem("segmiq-marketing-theme", theme);
    document.cookie = `segmiq-marketing-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** CRM app routes use CRM tokens (see globals.css). Excludes Segmiq Cloud and public auth. */
export function isCrmPath(pathname: string): boolean {
  if (pathname.startsWith("/cloud")) return false;
  // Public auth uses MarketingThemeProvider / AuthLayout — not CRM chrome.
  if (
    pathname === "/login" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    return false;
  }
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/solo") ||
    pathname.startsWith("/onboard") ||
    pathname.startsWith("/dev/sales-design-system")
  );
}
