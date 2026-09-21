"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { IconButton } from "@/components/sales/ui";
import { OverlayPortal } from "@/components/sales/ui/OverlayPortal";
import { formatMoney } from "@/lib/quotations/totals";
import type { AttentionItem } from "@/lib/sales/weekly-team-report/types";
import { dealHref } from "./format";

export function EvidenceDrawer({
  open,
  title,
  explanation,
  items,
  currency,
  onClose,
}: {
  open: boolean;
  title: string;
  explanation: string;
  items: AttentionItem[];
  currency: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--sales-z-modal,80)] flex justify-end">
        <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close evidence" onClick={onClose} />
        <aside
          role="dialog"
          aria-modal
          aria-labelledby="weekly-report-evidence-title"
          className="relative flex h-full w-full max-w-[420px] flex-col border-l border-sales-border bg-sales-surface shadow-sales-modal"
        >
          <div className="flex items-start justify-between gap-3 border-b border-sales-border-subtle px-5 py-4">
            <div>
              <h2 id="weekly-report-evidence-title" className="text-[16px] font-semibold text-sales-text-primary">
                {title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-sales-text-secondary">{explanation}</p>
            </div>
            <IconButton aria-label="Close" size="sm" icon={<X size={16} />} onClick={onClose} />
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <p className="text-[13px] text-sales-text-muted">No supporting records are listed for this finding.</p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="border-b border-sales-border-subtle pb-4 last:border-0">
                    <p className="font-medium text-sales-text-primary">{item.displayName}</p>
                    <p className="mt-1 text-[12px] text-sales-text-muted">
                      {item.salespersonName ?? "Unassigned"}
                      {item.value != null ? ` · ${formatMoney(item.value, currency)}` : ""}
                      {item.daysInactive != null ? ` · ${item.daysInactive}d inactive` : ""}
                    </p>
                    <p className="mt-2 text-[13px] text-sales-text-secondary">{item.reason}</p>
                    {item.entityKind === "deal" ? (
                      <Link
                        href={dealHref(item.entityId)}
                        className="mt-2 inline-flex text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
                      >
                        Open deal
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </OverlayPortal>
  );
}
