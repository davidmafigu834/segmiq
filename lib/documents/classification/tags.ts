import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLabel } from "@/lib/documents/classification/matching";

export async function applyDocumentTags(opts: {
  clientId: string;
  documentId: string;
  tags: string[];
  source: "HUMAN" | "AGENT";
}): Promise<string[]> {
  const unique = [...new Set(opts.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  if (!unique.length) return [];

  const supabase = createAdminClient();
  const tagIds: string[] = [];

  for (const name of unique) {
    const normalized = normalizeLabel(name);
    if (!normalized) continue;

    const { data: existing } = await supabase
      .from("document_tags")
      .select("id")
      .eq("client_id", opts.clientId)
      .eq("normalized_name", normalized)
      .maybeSingle();

    let tagId = existing?.id as string | undefined;
    if (!tagId) {
      const { data: created } = await supabase
        .from("document_tags")
        .insert({
          client_id: opts.clientId,
          name,
          normalized_name: normalized,
        })
        .select("id")
        .single();
      tagId = created?.id as string | undefined;
    }

    if (!tagId) continue;
    tagIds.push(tagId);

    await supabase.from("document_tag_links").upsert(
      {
        client_id: opts.clientId,
        document_id: opts.documentId,
        tag_id: tagId,
        source: opts.source,
      },
      { onConflict: "document_id,tag_id", ignoreDuplicates: true }
    );
  }

  return unique;
}

export async function listDocumentTags(clientId: string, documentId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_tag_links")
    .select("document_tags(name)")
    .eq("client_id", clientId)
    .eq("document_id", documentId);

  return (data ?? [])
    .map((row) => {
      const joined = row.document_tags as { name: string } | { name: string }[] | null;
      if (Array.isArray(joined)) return joined[0]?.name;
      return joined?.name;
    })
    .filter((name): name is string => Boolean(name));
}
