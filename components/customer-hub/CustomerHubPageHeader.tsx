"use client";

import { Footprints, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui";

export function CustomerHubPageHeader({
  clientName,
  title,
  description,
  onOpenAdd,
  onOpenWalkIn,
  showActions = true,
}: {
  clientName?: string;
  title: string;
  description: string;
  onOpenAdd?: () => void;
  onOpenWalkIn?: () => void;
  showActions?: boolean;
}) {
  return (
    <PageHeader
      className="mb-6 ag-fade-in"
      eyebrow={(clientName ? `${clientName} / ` : "") + "Customer Hub"}
      title={title}
      description={description}
      actions={
        showActions && onOpenAdd && onOpenWalkIn ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenWalkIn}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              <Footprints className="h-4 w-4" strokeWidth={1.5} />
              Walk-in
            </button>
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              Add contact
            </button>
          </div>
        ) : undefined
      }
    />
  );
}
