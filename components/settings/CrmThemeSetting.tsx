"use client";

import { useCrmTheme } from "@/components/CrmThemeProvider";
import type { CrmTheme } from "@/lib/crm-theme";

function ThemeOption({
  label,
  description,
  active,
  onSelect,
}: {
  label: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-1 flex-col rounded-lg border px-4 py-3 text-left transition-colors ${
        active
          ? "border-[var(--accent-border)] bg-[var(--accent-muted)]"
          : "border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--border-hover)]"
      }`}
    >
      <span
        className={`text-[13px] font-semibold ${
          active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {label}
      </span>
      <span className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{description}</span>
    </button>
  );
}

export function CrmThemeSetting() {
  const { theme, setTheme } = useCrmTheme();

  function pick(next: CrmTheme) {
    if (next !== theme) setTheme(next);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Choose how the CRM looks on this device. Dark is the default.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ThemeOption
          label="Dark"
          description="Low-light workspace"
          active={theme === "dark"}
          onSelect={() => pick("dark")}
        />
        <ThemeOption
          label="Light"
          description="Bright, high-contrast workspace"
          active={theme === "light"}
          onSelect={() => pick("light")}
        />
      </div>
    </section>
  );
}
