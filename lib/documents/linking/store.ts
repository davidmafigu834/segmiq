import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentEntityLinkRow, LinkCandidate } from "@/lib/documents/linking/types";

export async function upsertDocumentEntityLinks(opts: {
  clientId: string;
  documentId: string;
  candidates: Array<LinkCandidate & { confirmed: boolean }>;
  createdBy?: string | null;
}): Promise<number> {
  if (!opts.candidates.length) return 0;

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let written = 0;

  for (const candidate of opts.candidates) {
    const { data: existing } = await supabase
      .from("document_entity_links")
      .select("id, confirmed, source")
      .eq("document_id", opts.documentId)
      .eq("entity_type", candidate.entityType)
      .eq("entity_id", candidate.entityId)
      .maybeSingle();

    if (existing?.confirmed && existing.source === "HUMAN") continue;

    const { error } = await supabase.from("document_entity_links").upsert(
      {
        client_id: opts.clientId,
        document_id: opts.documentId,
        entity_type: candidate.entityType,
        entity_id: candidate.entityId,
        link_type: candidate.linkType,
        confidence: candidate.confidence,
        source: "AGENT",
        confirmed: candidate.confirmed,
        match_reason: candidate.matchReason,
        metadata: candidate.metadata ?? {},
        created_by: opts.createdBy ?? null,
        updated_at: now,
      },
      { onConflict: "document_id,entity_type,entity_id" }
    );

    if (!error) written += 1;
  }

  return written;
}

export async function createManualDocumentLink(opts: {
  clientId: string;
  documentId: string;
  candidate: LinkCandidate;
  actorUserId: string;
}): Promise<DocumentEntityLinkRow | null> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("document_entity_links")
    .upsert(
      {
        client_id: opts.clientId,
        document_id: opts.documentId,
        entity_type: opts.candidate.entityType,
        entity_id: opts.candidate.entityId,
        link_type: opts.candidate.linkType ?? "MANUAL",
        confidence: "HIGH",
        source: "HUMAN",
        confirmed: true,
        match_reason: opts.candidate.matchReason ?? "manual link",
        metadata: opts.candidate.metadata ?? {},
        created_by: opts.actorUserId,
        updated_at: now,
      },
      { onConflict: "document_id,entity_type,entity_id" }
    )
    .select("*")
    .single();

  if (error) return null;
  return data as DocumentEntityLinkRow;
}

export async function confirmDocumentEntityLink(opts: {
  clientId: string;
  documentId: string;
  linkId: string;
  actorUserId: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("document_entity_links")
    .update({
      confirmed: true,
      source: "HUMAN",
      created_by: opts.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.linkId)
    .eq("client_id", opts.clientId)
    .eq("document_id", opts.documentId);

  return !error;
}

export async function removeDocumentEntityLink(opts: {
  clientId: string;
  documentId: string;
  linkId: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("document_entity_links")
    .delete()
    .eq("id", opts.linkId)
    .eq("client_id", opts.clientId)
    .eq("document_id", opts.documentId);

  return !error;
}
