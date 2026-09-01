"use client";

import { useCallback, useState } from "react";
import { formatDocumentDate } from "@/lib/documents/format";
import {
  formatFactValue,
  formatSourceEvidence,
} from "@/lib/documents/intelligence/profiles";
import type { DocumentIntelligenceBundle } from "@/lib/documents/intelligence/types";
import { Badge, Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

function FactStatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMED" || status === "CORRECTED") {
    return (
      <Badge tone="success" size="sm" appearance="soft">
        Confirmed
      </Badge>
    );
  }
  if (status === "REJECTED") return null;
  return (
    <Badge tone="warning" size="sm" appearance="soft">
      Needs review
    </Badge>
  );
}

export function DocumentSummaryCard({
  intelligence,
}: {
  intelligence: DocumentIntelligenceBundle["intelligence"];
}) {
  if (!intelligence?.summary) {
    return (
      <div className="rounded-[12px] border border-dashed border-sales-border px-6 py-10 text-center">
        <p className="text-[14px] text-sales-text-secondary">No summary available yet.</p>
        <p className="mt-1 text-[13px] text-sales-text-muted">
          Summary is generated after document analysis completes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-sales-border bg-sales-surface-subtle p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">
        Document summary
      </p>
      <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-sales-text-primary">
        {intelligence.summary}
      </p>
      {intelligence.purpose ? (
        <p className="mt-4 text-[13px] text-sales-text-secondary">
          <span className="font-medium text-sales-text-muted">Purpose · </span>
          {intelligence.purpose}
        </p>
      ) : null}
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
      <div className="rounded-[12px] border border-dashed border-sales-border px-6 py-10 text-center">
        <p className="text-[14px] text-sales-text-secondary">No key terms extracted from this document yet.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-sales-border-subtle overflow-hidden rounded-[12px] border border-sales-border">
      {keyTerms.map((fact) => (
        <div key={fact.id} className="bg-sales-surface px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-sales-text-primary">{fact.label}</p>
              <p className="mt-1.5 text-[14px] text-sales-text-secondary">{formatFactValue(fact.value_json)}</p>
            </div>
            <FactStatusBadge status={fact.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-sales-text-muted">
              {formatSourceEvidence({ page: fact.page, clause: fact.clause, section: fact.section })}
            </p>
          </div>
          {fact.source_excerpt ? (
            <p className="mt-2 text-[12px] italic text-sales-text-muted">&ldquo;{fact.source_excerpt}&rdquo;</p>
          ) : null}
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
                variant="ghost"
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
  clientId,
  documentId,
  obligations,
}: {
  clientId: string;
  documentId: string;
  obligations: DocumentIntelligenceBundle["obligations"];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [taskLinks, setTaskLinks] = useState<Record<string, string>>({});

  const createTask = useCallback(
    async (obligationId: string) => {
      setBusyId(obligationId);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/company-documents/${documentId}/obligations/${obligationId}/create-task`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          tasksHref?: string;
        };
        if (res.ok && data.tasksHref) {
          setTaskLinks((prev) => ({ ...prev, [obligationId]: data.tasksHref! }));
        }
      } finally {
        setBusyId(null);
      }
    },
    [clientId, documentId]
  );
  if (!obligations.length) {
    return (
      <div className="rounded-[12px] border border-dashed border-sales-border px-6 py-10 text-center">
        <p className="text-[14px] text-sales-text-secondary">No obligations detected in this document.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-sales-border">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[11px] uppercase tracking-wide text-sales-text-muted">
            <th className="px-4 py-2.5 font-medium">Obligation</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Responsible</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Due</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {obligations.map((row) => (
            <tr key={row.id} className="border-b border-sales-border-subtle align-top last:border-0">
              <td className="px-4 py-3.5">
                <p className="font-medium text-sales-text-primary">{row.action}</p>
                {row.trigger_description ? (
                  <p className="mt-1 text-[12px] text-sales-text-muted">{row.trigger_description}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-sales-text-muted">
                  {formatSourceEvidence({ page: row.page, clause: row.clause })}
                </p>
              </td>
              <td className="hidden px-4 py-3.5 text-sales-text-secondary sm:table-cell">
                {row.responsible_party_text || row.responsible_party_type.replace(/_/g, " ")}
              </td>
              <td className="hidden px-4 py-3.5 text-sales-text-secondary md:table-cell">
                {row.due_date
                  ? formatDocumentDate(row.due_date)
                  : row.due_rule_json &&
                      typeof row.due_rule_json === "object" &&
                      row.due_rule_json &&
                      "text" in (row.due_rule_json as Record<string, unknown>)
                    ? (row.due_rule_json as { text: string }).text
                    : "—"}
              </td>
              <td className="px-4 py-3.5">
                <Badge tone={row.status === "PENDING" ? "warning" : "neutral"} size="sm" appearance="soft">
                  {row.status.replace(/_/g, " ")}
                </Badge>
              </td>
              <td className="px-4 py-3.5">
                {row.linked_task_id || taskLinks[row.id] ? (
                  <a
                    href={taskLinks[row.id] ?? `/sales/tasks?leadId=${row.linked_task_id}`}
                    className="text-[12px] font-medium text-sales-brand-fg hover:underline"
                  >
                    View task
                  </a>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void createTask(row.id)}
                  >
                    Create task
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <div className="rounded-[12px] border border-dashed border-sales-border px-6 py-10 text-center">
        <p className="text-[14px] text-sales-text-secondary">No important dates extracted yet.</p>
      </div>
    );
  }

  const now = Date.now();

  return (
    <ol className="relative space-y-0 border-l border-sales-border-subtle pl-6">
      {importantDates.map((row, index) => {
        const upcoming = row.date_value ? new Date(row.date_value).getTime() >= now : false;
        return (
          <li key={row.id} className={cn("relative pb-6", index === importantDates.length - 1 && "pb-0")}>
            <span
              className={cn(
                "absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-sales-surface",
                upcoming ? "bg-sales-brand" : "bg-sales-text-muted"
              )}
            />
            <p className="text-[12px] font-medium uppercase tracking-wide text-sales-text-muted">
              {row.date_type.replace(/_/g, " ")}
            </p>
            <p className="mt-0.5 text-[15px] font-medium text-sales-text-primary">{row.label}</p>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">
              {row.date_value ? formatDocumentDate(row.date_value) : row.date_text || "Date not fixed"}
            </p>
            <p className="mt-1 text-[11px] text-sales-text-muted">
              {formatSourceEvidence({ page: row.page, clause: row.clause })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
