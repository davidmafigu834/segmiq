"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ResidentialPremiumSolarDigital } from "@/components/quotations/layouts/ResidentialPremiumSolarDigital";
import type { QuoteDocumentModel } from "@/lib/quotations/layouts/types";
import { Button } from "@/components/sales/ui";

export function QuoteTemplatePreviewDialog({
  clientId,
  templateId,
  templateName,
  onClose,
}: {
  clientId: string;
  templateId: string;
  templateName: string;
  onClose: () => void;
}) {
  const [model, setModel] = useState<QuoteDocumentModel | null>(null);
  const [error, setError] = useState("");
  const pdfHref = `/api/clients/${clientId}/quote-templates/${templateId}/preview?format=pdf`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/quote-templates/${templateId}/preview`)
      .then(async (res) => {
        const json = (await res.json()) as { model?: QuoteDocumentModel; error?: string };
        if (!res.ok || !json.model) throw new Error(json.error || "Preview unavailable");
        return json.model;
      })
      .then((next) => {
        if (!cancelled) setModel(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Preview unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, templateId]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-[var(--sales-overlay)]" aria-label="Close preview" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="template-preview-title"
        className="relative z-[81] flex max-h-[calc(100dvh-24px)] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[16px] border border-sales-border bg-sales-surface shadow-sales-modal sm:rounded-[16px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-sales-border px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sales-text-muted">
              Sample preview
            </p>
            <h2 id="template-preview-title" className="text-[16px] font-semibold text-sales-text-primary">
              {templateName}
            </h2>
            <p className="mt-0.5 text-[12px] text-sales-text-secondary">
              Illustrative customer and site data so every section is visible. Your company brand is applied. This is
              not a real quotation.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-semibold text-sales-text-primary underline"
            >
              Open PDF
            </a>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-sales-text-muted hover:bg-sales-surface-hover">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#E8E8E8] p-3 sm:p-5">
          {error ? (
            <p className="rounded-[10px] bg-white px-4 py-6 text-center text-[13px] text-sales-danger">{error}</p>
          ) : !model ? (
            <p className="rounded-[10px] bg-white px-4 py-6 text-center text-[13px] text-sales-text-muted">
              Loading preview…
            </p>
          ) : (
            <div className="mx-auto max-w-[794px] overflow-hidden rounded-[4px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <ResidentialPremiumSolarDigital model={model} />
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-sales-border px-4 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
