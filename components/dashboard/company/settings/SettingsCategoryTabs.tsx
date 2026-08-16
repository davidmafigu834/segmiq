"use client";

import Link from "next/link";
import { SETTINGS_CATEGORIES, SETTINGS_CATEGORY_LABELS, settingsPath } from "@/lib/settings/company-settings-config";
import type { SettingsCategory } from "@/lib/settings/company-settings-config";
import { cn } from "@/lib/ui/cn";

export function SettingsCategoryTabs({
  active,
  previewClientId,
}: {
  active: SettingsCategory;
  previewClientId?: string | null;
}) {
  return (
    <nav
      aria-label="Settings categories"
      className="flex min-w-0 gap-1 overflow-x-auto border-b border-sales-border-subtle scrollbar-hide"
    >
      {SETTINGS_CATEGORIES.map((id) => {
        const selected = id === active;
        return (
          <Link
            key={id}
            href={settingsPath(id, undefined, previewClientId)}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-[13px] font-medium transition-colors",
              selected
                ? "text-sales-text-primary"
                : "text-sales-text-muted hover:text-sales-text-primary"
            )}
          >
            {SETTINGS_CATEGORY_LABELS[id]}
            {selected ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sales-brand" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

