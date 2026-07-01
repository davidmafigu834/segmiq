"use client";

import { Moon, Sun } from "lucide-react";
import { useBlogTheme } from "@/components/blog/BlogThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useBlogTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 rounded-md border border-black/10 dark:border-white/15 grid place-items-center text-[#666] dark:text-white/70 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/25 transition-colors"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
