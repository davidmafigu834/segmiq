"use client";

import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Badge } from "@/components/sales/ui";
import { DocumentSourceCitation } from "./document-ui";
import type { DocumentAskCitation } from "@/lib/documents/retrieval/types";

export type AskAnswerState = {
  question: string;
  answer: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  citations: DocumentAskCitation[];
  insufficientEvidence: boolean;
};

function confidenceTone(confidence: AskAnswerState["confidence"]) {
  if (confidence === "HIGH") return "success" as const;
  if (confidence === "MEDIUM") return "warning" as const;
  return "neutral" as const;
}

export function AskDocumentsAnswerWorkspace({
  state,
  loading,
  error,
  documentId,
  onCitationOpen,
  className,
}: {
  state: AskAnswerState | null;
  loading?: boolean;
  error?: string | null;
  documentId?: string;
  onCitationOpen?: (citation: DocumentAskCitation) => void;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-8",
          className
        )}
      >
        <Loader2 size={18} className="animate-spin text-sales-brand-fg" />
        <p className="text-[13px] text-sales-text-secondary">Searching documents and composing an answer…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-[10px] border border-sales-danger/25 bg-sales-danger-soft px-4 py-3 text-[13px] text-sales-danger-fg",
          className
        )}
      >
        {error}
      </div>
    );
  }

  if (!state) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="border-b border-sales-border-subtle px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles size={14} className="text-sales-brand-fg" />
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">
              Answer
            </p>
            {state.confidence ? (
              <Badge tone={confidenceTone(state.confidence)} size="sm" appearance="soft">
                {state.confidence.toLowerCase()} confidence
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="px-4 py-4">
          {state.answer ? (
            <p className="max-w-3xl whitespace-pre-line text-[14px] leading-relaxed text-sales-text-primary">
              {state.answer}
            </p>
          ) : state.citations.length ? (
            <p className="text-[14px] text-sales-text-secondary">
              I found related documents but couldn&apos;t compose a full answer. Review the sources
              below.
            </p>
          ) : (
            <p className="text-[14px] text-sales-text-secondary">
              I couldn&apos;t find enough information in your documents to answer that question. Try
              rephrasing, or check that the relevant documents have finished processing.
            </p>
          )}
          {state.insufficientEvidence && state.answer ? (
            <p className="mt-3 text-[12px] text-sales-warning-fg">
              This answer may be incomplete — review the sources below.
            </p>
          ) : null}
        </div>
      </div>

      {state.citations.length ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">
            Sources
          </p>
          <ul className="space-y-2">
            {state.citations.map((citation, index) => {
              const href = documentId
                ? `/client/documents/${documentId}?tab=document&page=${citation.pageNumber ?? ""}&highlight=${encodeURIComponent(citation.excerpt.slice(0, 120))}`
                : `/client/documents/${citation.documentId}?tab=document&page=${citation.pageNumber ?? ""}&highlight=${encodeURIComponent(citation.excerpt.slice(0, 120))}`;

              return (
                <li key={`${citation.documentId}-${citation.chunkId}-${index}`}>
                  <DocumentSourceCitation
                    title={citation.documentTitle}
                    page={citation.pageNumber}
                    excerpt={citation.excerpt}
                    href={onCitationOpen ? undefined : href}
                    onOpen={onCitationOpen ? () => onCitationOpen(citation) : undefined}
                  />
                  {!onCitationOpen && !documentId ? (
                    <Link
                      href={`/client/documents/${citation.documentId}`}
                      className="mt-1 inline-block text-[11px] font-medium text-sales-brand-fg hover:underline"
                    >
                      Open document
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
