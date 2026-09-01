import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLabel } from "@/lib/documents/classification/matching";

export type DocumentCategoryRow = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_by: string | null;
  creation_source: "HUMAN" | "AGENT";
  status: string;
};

export async function listActiveCategories(clientId: string): Promise<DocumentCategoryRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_categories")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "ACTIVE")
    .order("name", { ascending: true });
  return (data as DocumentCategoryRow[]) ?? [];
}

export async function createCategory(opts: {
  clientId: string;
  name: string;
  description?: string | null;
  createdBy?: string | null;
  creationSource: "HUMAN" | "AGENT";
}): Promise<DocumentCategoryRow | null> {
  const name = opts.name.trim();
  if (!name) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_categories")
    .insert({
      client_id: opts.clientId,
      name,
      description: opts.description ?? null,
      created_by: opts.createdBy ?? null,
      creation_source: opts.creationSource,
      status: "ACTIVE",
    })
    .select("*")
    .single();

  if (error) {
    const existing = await supabase
      .from("document_categories")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("status", "ACTIVE")
      .ilike("name", name)
      .maybeSingle();
    return (existing.data as DocumentCategoryRow | null) ?? null;
  }

  return data as DocumentCategoryRow;
}

export async function mergeCategories(opts: {
  clientId: string;
  sourceCategoryId: string;
  targetCategoryId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  await supabase
    .from("documents")
    .update({ category_id: opts.targetCategoryId, updated_at: new Date().toISOString() })
    .eq("client_id", opts.clientId)
    .eq("category_id", opts.sourceCategoryId);

  await supabase
    .from("document_categories")
    .update({ status: "MERGED", updated_at: new Date().toISOString() })
    .eq("client_id", opts.clientId)
    .eq("id", opts.sourceCategoryId);

  return { ok: true };
}

export async function getCategoryDocumentCounts(clientId: string) {
  const supabase = createAdminClient();
  const { data: categories } = await supabase
    .from("document_categories")
    .select("id, name, description, creation_source, status, created_at")
    .eq("client_id", clientId)
    .neq("status", "MERGED")
    .order("name");

  const rows = categories ?? [];
  const counts = await Promise.all(
    rows.map(async (cat) => {
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("category_id", cat.id)
        .is("archived_at", null);
      return { ...cat, document_count: count ?? 0 };
    })
  );

  return counts;
}

export function findCategoryByNormalizedName(
  categories: DocumentCategoryRow[],
  name: string
): DocumentCategoryRow | null {
  const target = normalizeLabel(name);
  return categories.find((c) => normalizeLabel(c.name) === target) ?? null;
}
