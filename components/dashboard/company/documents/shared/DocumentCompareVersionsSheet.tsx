"use client";

import { useEffect, useState } from "react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Skeleton } from "@/components/sales/ui";
import type { DocumentVersionDiffRow } from "@/lib/documents/compare-versions";

export function DocumentCompareVersionsSheet({
  clientId,
  documentId,
  fromVersionId,
  toVersionId,
  fromLabel,
  toLabel,
  onClose,
}: {
  clientId: string;
  documentId: string;
  fromVersionId: string;
  toVersionId: string;
  fromLabel: string;
  toLabel: string;
  onClose: () => void;
}) {
  const [diffs, setDiffs] = useState<DocumentVersionDiffRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ from: fromVersionId, to: toVersionId });
    fetch(`/api/clients/${clientId}/company-documents/${documentId}/compare?${params}`)
      .then(async (res) => {
        const json = (await res.json()) as { diffs?: DocumentVersionDiffRow[] };
        if (!res.ok || !json.diffs) throw new Error("compare failed");
        if (!cancelled) setDiffs(json.diffs);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, documentId, fromVersionId, toVersionId]);

  return (
    <PremiumSheet
      title="Compare versions"
      description={`${fromLabel} → ${toLabel}`}
      size="sm"
      maxWidthClass="max-w-lg"
      onClose={onClose}
    >
      {error ? (
        <p className="text-[12px] text-sales-text-muted">Version comparison could not be loaded.</p>
      ) : !diffs ? (
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : diffs.length === 0 ? (
        <p className="text-[12px] text-sales-text-muted">No text differences between these versions.</p>
      ) : (
        <ul className="divide-y divide-sales-border-subtle">
          {diffs.map((diff) => (
            <li
              key={`${diff.field}-${diff.from}-${diff.to}`}
              className="grid grid-cols-[minmax(0,1.2fr)_1fr_1fr] gap-2 py-2.5 text-[12px]"
            >
              <p className="font-medium text-sales-text-primary">
                {diff.field}
                <span className="ml-2 rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[9px] uppercase text-sales-text-muted">
                  {diff.from === "—" ? "Added" : diff.to === "—" ? "Removed" : "Changed"}
                </span>
              </p>
              <p className="tabular-nums text-sales-text-muted">{diff.from}</p>
              <p className="tabular-nums text-sales-text-primary">{diff.to}</p>
            </li>
          ))}
        </ul>
      )}
    </PremiumSheet>
  );
}
