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
      className="w-9 h-9 grid place-items-center text-[#666] dark:text-white/70 hover:text-black dark:hover:text-white transition-colors"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
