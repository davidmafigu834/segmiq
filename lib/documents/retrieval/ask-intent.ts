import { createAdminClient } from "@/lib/supabase/admin";
import { canViewDocument } from "@/lib/documents/permissions";
import { formatFactValue } from "@/lib/documents/intelligence/profiles";
import { formatDocumentDate } from "@/lib/documents/format";
import type { DocumentActor, DocumentRow } from "@/lib/documents/types";

export type AskIntent = {
  lifecycleStatuses?: string[];
  processingStatuses?: string[];
  typeCodes?: string[];
  dateTypes?: string[];
  expiringWithinDays?: number;
};

export type AskContextSource = {
  sourceId: string;
  chunkId: string | null;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  excerpt: string;
  score: number;
};

export function parseAskIntent(question: string): AskIntent {
  const lower = question.toLowerCase();
  const intent: AskIntent = {};

  if (/need(s)? review|review queue|needs attention|awaiting review/.test(lower)) {
    intent.processingStatuses = ["NEEDS_REVIEW"];
  }
  if (/\bfailed\b|analysis failed|couldn.?t analyze/.test(lower)) {
    intent.processingStatuses = ["FAILED"];
  }
  if (/process(ing)?|still upload|being analyzed/.test(lower)) {
    intent.processingStatuses = ["QUEUED", "EXTRACTING", "ANALYZING", "INDEXING", "UPLOADED"];
  }
  if (/signed|executed|fully executed/.test(lower)) {
    intent.lifecycleStatuses = ["SIGNED", "ACTIVE"];
  }
  if (/expir(e|ing|y)|renewal|renew/.test(lower)) {
    intent.dateTypes = ["EXPIRY", "RENEWAL"];
    intent.expiringWithinDays = 180;
  }
  if (/compliance|certificate|certificates|licen[sc]e|insurance/.test(lower)) {
    intent.typeCodes = ["CERTIFICATE", "LICENCE", "INSURANCE"];
  }
  if (/\bcontract(s)?\b|\bagreement(s)?\b|\bnda\b/.test(lower)) {
    intent.typeCodes = [...new Set([...(intent.typeCodes ?? []), "CONTRACT"])];
  }
  if (/proposal|quote|quotation/.test(lower)) {
    intent.typeCodes = [...new Set([...(intent.typeCodes ?? []), "PROPOSAL"])];
  }
  if (/polic(y|ies)/.test(lower)) {
    intent.typeCodes = [...new Set([...(intent.typeCodes ?? []), "COMPANY_POLICY"])];
  }

  return intent;
}

async function loadAccessPolicy(documentId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_access_policies")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();
  return data;
}

async function resolveTypeIds(clientId: string, codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_types")
    .select("id")
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .in("code", codes);
  return (data ?? []).map((r) => r.id as string);
}

export async function loadStructuredAskSources(opts: {
  clientId: string;
  actor: DocumentActor;
  intent: AskIntent;
  limit?: number;
}): Promise<AskContextSource[]> {
  const intent = opts.intent;
  const hasStructured =
    Boolean(intent.lifecycleStatuses?.length) ||
    Boolean(intent.processingStatuses?.length) ||
    Boolean(intent.typeCodes?.length) ||
    Boolean(intent.dateTypes?.length);

  if (!hasStructured) return [];

  const supabase = createAdminClient();
  const limit = Math.min(opts.limit ?? 12, 20);
  const sources: AskContextSource[] = [];

  if (intent.dateTypes?.length) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + (intent.expiringWithinDays ?? 180));
    const horizonIso = horizon.toISOString().slice(0, 10);

    const { data: dateRows } = await supabase
      .from("document_important_dates")
      .select(
        `id, label, date_type, date_value, date_text, page, document_id,
        documents!inner(id, title, lifecycle_status, processing_status, archived_at, client_id, owner_user_id, uploaded_by, current_version_id)`
      )
      .eq("client_id", opts.clientId)
      .in("date_type", intent.dateTypes)
      .neq("status", "REJECTED")
      .order("date_value", { ascending: true, nullsFirst: false })
      .limit(40);

    for (const row of dateRows ?? []) {
      const docJoin = row.documents as
        | DocumentRow
        | DocumentRow[]
        | null;
      const doc = Array.isArray(docJoin) ? docJoin[0] : docJoin;
      if (!doc || doc.archived_at) continue;
      if (row.date_value && row.date_value > horizonIso) continue;

      const policy = await loadAccessPolicy(doc.id);
      if (!canViewDocument(opts.actor, doc, policy)) continue;

      const when = row.date_value
        ? formatDocumentDate(row.date_value as string)
        : (row.date_text as string) || "Date not fixed";

      sources.push({
        sourceId: `date-${row.id}`,
        chunkId: null,
        documentId: doc.id,
        documentTitle: doc.title,
        pageNumber: (row.page as number | null) ?? null,
        excerpt: `${row.label as string} (${String(row.date_type).replace(/_/g, " ").toLowerCase()}): ${when}`,
        score: 0.92,
      });
    }
  }

  let docQuery = supabase
    .from("documents")
    .select("*, document_types(code, label)")
    .eq("client_id", opts.clientId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (intent.lifecycleStatuses?.length) {
    docQuery = docQuery.in("lifecycle_status", intent.lifecycleStatuses);
  }
  if (intent.processingStatuses?.length) {
    if (intent.processingStatuses.includes("PROCESSING")) {
      docQuery = docQuery.in("processing_status", [
        "QUEUED",
        "EXTRACTING",
        "ANALYZING",
        "INDEXING",
        "UPLOADED",
      ]);
    } else {
      docQuery = docQuery.in("processing_status", intent.processingStatuses);
    }
  }
  if (intent.typeCodes?.length) {
    const typeIds = await resolveTypeIds(opts.clientId, intent.typeCodes);
    if (!typeIds.length && !intent.dateTypes?.length) return sources.slice(0, limit);
    if (typeIds.length) {
      docQuery = docQuery.in("document_type_id", typeIds);
    }
  }

  const shouldQueryDocs =
    Boolean(intent.lifecycleStatuses?.length) ||
    Boolean(intent.processingStatuses?.length) ||
    Boolean(intent.typeCodes?.length);

  if (!shouldQueryDocs) {
    return sources.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  const { data: docs } = await docQuery;

  for (const row of docs ?? []) {
    const doc = row as DocumentRow & {
      document_types?: { code: string; label: string } | { code: string; label: string }[] | null;
    };
    const policy = await loadAccessPolicy(doc.id);
    if (!canViewDocument(opts.actor, doc, policy)) continue;

    const typeJoin = doc.document_types;
    const typeLabel = Array.isArray(typeJoin) ? typeJoin[0]?.label : typeJoin?.label;

    const versionId = doc.current_version_id;
    let summaryExcerpt = `${typeLabel ?? "Document"} · ${doc.lifecycle_status.replace(/_/g, " ")} · ${doc.processing_status.replace(/_/g, " ")}`;

    if (versionId) {
      const { data: intel } = await supabase
        .from("document_intelligence")
        .select("summary")
        .eq("client_id", opts.clientId)
        .eq("version_id", versionId)
        .maybeSingle();
      if (intel?.summary) {
        summaryExcerpt = String(intel.summary).slice(0, 280);
      } else {
        const { data: facts } = await supabase
          .from("document_facts")
          .select("label, value_json, fact_type")
          .eq("client_id", opts.clientId)
          .eq("version_id", versionId)
          .neq("status", "REJECTED")
          .limit(3);
        if (facts?.length) {
          summaryExcerpt = facts
            .map((f) => `${f.label}: ${formatFactValue(f.value_json)}`)
            .join(" · ");
        }
      }
    }

    sources.push({
      sourceId: `doc-${doc.id}`,
      chunkId: null,
      documentId: doc.id,
      documentTitle: doc.title,
      pageNumber: null,
      excerpt: summaryExcerpt,
      score: 0.85,
    });
  }

  const byDoc = new Map<string, AskContextSource>();
  for (const source of sources) {
    const existing = byDoc.get(source.documentId);
    if (!existing || source.score > existing.score) {
      byDoc.set(source.documentId, source);
    }
  }

  return [...byDoc.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function buildDeterministicAskAnswer(
  question: string,
  sources: AskContextSource[]
): string | null {
  if (!sources.length) return null;

  const lower = question.toLowerCase();
  const lines = sources.map((s) => {
    const when = s.pageNumber ? ` (page ${s.pageNumber})` : "";
    return `• ${s.documentTitle}${when} — ${s.excerpt}`;
  });

  if (/expir|renew/.test(lower)) {
    return `I found ${sources.length} document${sources.length === 1 ? "" : "s"} with upcoming or recorded expiry/renewal dates:\n\n${lines.join("\n")}`;
  }
  if (/signed|agreement/.test(lower)) {
    return `I found ${sources.length} signed or active document${sources.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
  }
  if (/review|attention/.test(lower)) {
    return `I found ${sources.length} document${sources.length === 1 ? "" : "s"} that may need review:\n\n${lines.join("\n")}`;
  }
  if (/compliance|certificate/.test(lower)) {
    return `I found ${sources.length} compliance-related document${sources.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
  }

  return `I found ${sources.length} relevant document${sources.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
}
