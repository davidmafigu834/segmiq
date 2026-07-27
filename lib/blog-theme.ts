export const BLOG_THEME_STORAGE_KEY = "segmiq-wire-theme";

export type BlogTheme = "light" | "dark";

export function parseBlogTheme(value: string | undefined | null): BlogTheme {
  return value === "dark" ? "dark" : "light";
}

export function persistBlogTheme(theme: BlogTheme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BLOG_THEME_STORAGE_KEY, theme);
    document.cookie = `${BLOG_THEME_STORAGE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
