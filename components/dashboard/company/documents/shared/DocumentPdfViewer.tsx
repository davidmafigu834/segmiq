"use client";

import { useMemo } from "react";
import { cn } from "@/lib/ui/cn";
import { DocumentSourceCitation } from "./document-ui";

export function DocumentPdfViewer({
  title,
  previewUrl,
  page,
  highlight,
  className,
}: {
  title: string;
  previewUrl: string;
  page?: number | null;
  highlight?: string | null;
  className?: string;
}) {
  const iframeSrc = useMemo(() => {
    if (!page || page < 1) return previewUrl;
    return `${previewUrl}#page=${page}`;
  }, [previewUrl, page]);

  return (
    <div className={cn("space-y-3", className)}>
      {highlight ? (
        <div className="rounded-[10px] border border-sales-brand-border bg-sales-brand-soft px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">
            Source passage
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-sales-text-primary">
            <mark className="rounded bg-sales-warning-soft px-0.5 text-sales-text-primary">
              {highlight}
            </mark>
          </p>
          {page ? (
            <p className="mt-2 text-[12px] text-sales-text-muted">Referenced on page {page}</p>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface-subtle">
        <iframe title={title} src={iframeSrc} className="h-[72vh] w-full bg-white" />
      </div>
    </div>
  );
}

export function DocumentPdfCitationHighlight({
  title,
  page,
  excerpt,
  onJump,
}: {
  title: string;
  page?: number | null;
  excerpt?: string | null;
  onJump?: () => void;
}) {
  return (
    <DocumentSourceCitation
      title={title}
      page={page}
      excerpt={excerpt}
      onOpen={onJump}
    />
  );
}
