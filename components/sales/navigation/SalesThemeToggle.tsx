"use client";

import { Moon, Sun } from "lucide-react";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { cn } from "@/lib/ui/cn";

/**
 * Compact Light/Dark toggle for the salesperson shell.
 * Reuses CrmThemeProvider preference (shared CRM + sales persistence).
 */
export function SalesThemeToggle({
  className,
  size = "desktop",
}: {
  className?: string;
  size?: "desktop" | "mobile";
}) {
  const ctx = useCrmThemeOptional();
  if (!ctx) return null;

  const { theme, setTheme } = ctx;
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const dim = size === "mobile" ? "h-11 w-11 min-h-[44px] min-w-[44px]" : "h-10 w-10 min-h-10 min-w-10";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sales-md border border-sales-border bg-sales-surface text-sales-text-secondary transition-colors duration-150",
        "hover:bg-sales-surface-hover hover:text-sales-text-primary hover:border-sales-border-strong",
        "focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
        dim,
        className
      )}
    >
      {isDark ? (
        <Sun size={16} strokeWidth={1.8} aria-hidden />
      ) : (
        <Moon size={16} strokeWidth={1.8} aria-hidden />
      )}
    </button>
  );
}
