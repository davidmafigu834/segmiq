"use client";

import { Moon, Sun } from "lucide-react";
import { useMarketingTheme } from "@/components/marketing/MarketingThemeProvider";

export default function AuthThemeToggle() {
  const { theme, toggleTheme } = useMarketingTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[9px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] text-[var(--marketing-text-secondary)] transition-colors duration-150 hover:bg-[var(--marketing-hover)] hover:text-[var(--marketing-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marketing-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-bg)]"
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
