"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/sales/ui";
import type { DocumentAskCitation } from "@/lib/documents/retrieval/types";
import {
  AskDocumentsAnswerWorkspace,
  type AskAnswerState,
} from "./AskDocumentsAnswerWorkspace";

const DEFAULT_SUGGESTIONS = [
  "Which contracts expire soon?",
  "Find signed agreements",
  "Show documents needing review",
  "What compliance certificates do we have?",
];

export function AskDocumentsComposer({
  clientId,
  documentId,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
  compact,
  initialQuestion,
  onCitationOpen,
}: {
  clientId: string;
  documentId?: string;
  suggestions?: string[];
  className?: string;
  compact?: boolean;
  initialQuestion?: string;
  onCitationOpen?: (citation: DocumentAskCitation) => void;
}) {
  const [query, setQuery] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAnswerState | null>(null);
  const [asked, setAsked] = useState(Boolean(initialQuestion));

  const runAsk = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      setAsked(true);
      try {
        const res = await fetch(`/api/clients/${clientId}/company-documents/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            documentId,
            limit: documentId ? 8 : 10,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as AskAnswerState & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not answer that question");
          setAnswer(null);
          return;
        }
        setAnswer(data);
      } catch {
        setError("Could not answer that question");
        setAnswer(null);
      } finally {
        setLoading(false);
      }
    },
    [clientId, documentId]
  );

  useEffect(() => {
    if (initialQuestion?.trim()) {
      void runAsk(initialQuestion);
    }
  }, [initialQuestion, runAsk]);

  const label = documentId ? "Ask this document" : "Ask SegmiQ about your documents";
  const placeholder = documentId
    ? "Ask about payment terms, expiry, obligations…"
    : "Ask about a contract, customer, agreement, obligation or date…";

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        {!compact ? (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">
            {label}
          </p>
        ) : null}
        <div className="flex items-center gap-2 rounded-[12px] border border-sales-border bg-sales-surface-subtle p-1.5 pl-3">
          <Sparkles size={16} strokeWidth={1.8} className="shrink-0 text-sales-brand-fg" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runAsk(query);
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-sales-text-primary placeholder:text-sales-text-muted focus:outline-none"
          />
          <Button
            variant="primary"
            size="md"
            disabled={loading || !query.trim()}
            onClick={() => void runAsk(query)}
            className="shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </Button>
        </div>
        {!compact ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  void runAsk(s);
                }}
                className="rounded-full border border-sales-border bg-sales-surface px-3 py-1 text-[12px] text-sales-text-secondary transition-colors hover:border-sales-border-strong hover:text-sales-text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {asked ? (
        <AskDocumentsAnswerWorkspace
          state={answer}
          loading={loading}
          error={error}
          documentId={documentId}
          onCitationOpen={onCitationOpen}
        />
      ) : null}
    </div>
  );
}
