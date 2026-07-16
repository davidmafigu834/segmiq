export const CRM_THEME_STORAGE_KEY = "segmiq-crm-theme";

export type CrmTheme = "light" | "dark";

export function parseCrmTheme(value: string | undefined | null): CrmTheme {
  return value === "light" ? "light" : "dark";
}

export function readStoredCrmTheme(): CrmTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return parseCrmTheme(localStorage.getItem(CRM_THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function persistCrmTheme(theme: CrmTheme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CRM_THEME_STORAGE_KEY, theme);
    document.cookie = `${CRM_THEME_STORAGE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** CRM app routes use CRM tokens (see globals.css). Excludes Segmiq Cloud. */
export function isCrmPath(pathname: string): boolean {
  if (pathname.startsWith("/cloud")) return false;
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/solo") ||
    pathname === "/login" ||
    pathname.startsWith("/onboard") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}
