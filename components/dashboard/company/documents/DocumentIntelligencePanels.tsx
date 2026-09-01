"use client";

import { useCallback, useState } from "react";
import { formatDocumentDate } from "@/lib/documents/format";
import {
  formatFactValue,
  formatSourceEvidence,
} from "@/lib/documents/intelligence/profiles";
import type { DocumentIntelligenceBundle } from "@/lib/documents/intelligence/types";
import { Button } from "@/components/sales/ui";

function FactStatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMED" || status === "CORRECTED") {
    return <span className="text-xs text-lime-400">Verified</span>;
  }
  if (status === "REJECTED") return null;
  return <span className="text-xs text-zinc-500">AI extracted</span>;
}

function EvidenceBlock({
  page,
  clause,
  section,
  excerpt,
}: {
  page?: number | null;
  clause?: string | null;
  section?: string | null;
  excerpt?: string | null;
}) {
  return (
    <div className="mt-2 rounded-md border border-zinc-800/80 bg-zinc-950/60 px-3 py-2">
      <p className="text-xs text-zinc-500">
        Source: {formatSourceEvidence({ page, clause, section })}
      </p>
      {excerpt ? <p className="mt-1 text-xs italic text-zinc-400">&ldquo;{excerpt}&rdquo;</p> : null}
    </div>
  );
}

export function DocumentSummaryCard({
  intelligence,
}: {
  intelligence: DocumentIntelligenceBundle["intelligence"];
}) {
  if (!intelligence?.summary) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
        <p className="text-sm text-zinc-400">No summary available yet.</p>
        <p className="mt-1 text-xs text-zinc-600">
          Summary is generated after document analysis completes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Summary</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{intelligence.summary}</p>
      {intelligence.purpose ? (
        <p className="mt-3 text-sm text-zinc-400">
          <span className="text-zinc-500">Purpose: </span>
          {intelligence.purpose}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-zinc-600">
        Confidence {intelligence.extraction_confidence.toLowerCase()} ·{" "}
        {formatDocumentDate(intelligence.generated_at)}
      </p>
    </div>
  );
}

export function DocumentKeyTermsPanel({
  clientId,
  documentId,
  keyTerms,
  canCorrect,
}: {
  clientId: string;
  documentId: string;
  keyTerms: DocumentIntelligenceBundle["keyTerms"];
  canCorrect: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const reviewFact = useCallback(
    async (factId: string, action: "confirm" | "reject") => {
      setBusyId(factId);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/company-documents/${documentId}/facts/${factId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          }
        );
        if (res.ok) window.location.reload();
      } finally {
        setBusyId(null);
      }
    },
    [clientId, documentId]
  );

  if (!keyTerms.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
        <p className="text-sm text-zinc-400">No key terms extracted from this document yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keyTerms.map((fact) => (
        <div key={fact.id} className="rounded-lg border border-zinc-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{fact.label}</p>
              <p className="mt-1 text-sm text-zinc-300">{formatFactValue(fact.value_json)}</p>
            </div>
            <FactStatusBadge status={fact.status} />
          </div>
          <EvidenceBlock
            page={fact.page}
            clause={fact.clause}
            section={fact.section}
            excerpt={fact.source_excerpt}
          />
          {canCorrect && fact.status === "EXTRACTED" ? (
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === fact.id}
                onClick={() => void reviewFact(fact.id, "confirm")}
              >
                Confirm
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === fact.id}
                onClick={() => void reviewFact(fact.id, "reject")}
              >
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DocumentObligationsPanel({
  obligations,
}: {
  obligations: DocumentIntelligenceBundle["obligations"];
}) {
  if (!obligations.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
        <p className="text-sm text-zinc-400">No obligations detected in this document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {obligations.map((row) => (
        <div key={row.id} className="rounded-lg border border-zinc-800 p-4">
          <p className="text-sm font-medium text-white">{row.action}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {row.responsible_party_text || row.responsible_party_type.replace(/_/g, " ")}
          </p>
          {row.trigger_description ? (
            <p className="mt-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Trigger: </span>
              {row.trigger_description}
            </p>
          ) : null}
          {row.due_date ? (
            <p className="mt-1 text-sm text-zinc-300">
              <span className="text-zinc-500">Due: </span>
              {formatDocumentDate(row.due_date)}
            </p>
          ) : row.due_rule_json &&
            typeof row.due_rule_json === "object" &&
            row.due_rule_json &&
            "text" in (row.due_rule_json as Record<string, unknown>) ? (
            <p className="mt-1 text-sm text-amber-100/90">
              Due: {(row.due_rule_json as { text: string }).text}
              <span className="text-zinc-500"> · waiting for trigger</span>
            </p>
          ) : null}
          <EvidenceBlock
            page={row.page}
            clause={row.clause}
            excerpt={row.source_excerpt}
          />
        </div>
      ))}
    </div>
  );
}

export function DocumentDatesPanel({
  importantDates,
}: {
  importantDates: DocumentIntelligenceBundle["importantDates"];
}) {
  if (!importantDates.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
        <p className="text-sm text-zinc-400">No important dates extracted yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Source</th>
          </tr>
        </thead>
        <tbody>
          {importantDates.map((row) => (
            <tr key={row.id} className="border-b border-zinc-900 align-top">
              <td className="px-4 py-3">
                <p className="text-white">{row.label}</p>
                <p className="mt-0.5 text-zinc-400">
                  {row.date_value
                    ? formatDocumentDate(row.date_value)
                    : row.date_text || "Date not fixed"}
                </p>
              </td>
              <td className="px-4 py-3 text-zinc-400">{row.date_type.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 text-xs text-zinc-500">
                {formatSourceEvidence({ page: row.page, clause: row.clause })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
