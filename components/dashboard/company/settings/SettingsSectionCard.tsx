"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

export function SettingsSectionCard({
  title,
  description,
  onEdit,
  editLabel = "Edit",
  children,
  className,
}: {
  title: string;
  description?: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[12px] border border-sales-border bg-sales-surface", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-sales-border-subtle px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-sales-text-primary">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">{description}</p>
          ) : null}
        </div>
        {onEdit ? (
          <Button variant="secondary" size="sm" leftIcon={<Pencil size={13} />} onClick={onEdit}>
            {editLabel}
          </Button>
        ) : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function SettingsInfoGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">{row.label}</dt>
          <dd className="mt-1 truncate text-[13px] text-sales-text-primary">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
