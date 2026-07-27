"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { persistBlogTheme, type BlogTheme } from "@/lib/blog-theme";

type BlogThemeContextValue = {
  theme: BlogTheme;
  toggleTheme: () => void;
};

const BlogThemeContext = createContext<BlogThemeContextValue | null>(null);

export function BlogThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: React.ReactNode;
  initialTheme?: BlogTheme;
}) {
  const [theme, setTheme] = useState<BlogTheme>(initialTheme);

  useEffect(() => {
    persistBlogTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <BlogThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme === "dark" ? "dark" : undefined}>{children}</div>
    </BlogThemeContext.Provider>
  );
}

export function useBlogTheme() {
  const ctx = useContext(BlogThemeContext);
  if (!ctx) throw new Error("useBlogTheme must be used within BlogThemeProvider");
  return ctx;
}
