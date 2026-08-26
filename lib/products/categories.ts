import { createAdminClient } from "@/lib/supabase/admin";

export async function listCategories(clientId: string, q?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("product_categories")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) return { error: error.message, categories: [] };

  const ids = (data ?? []).map((c) => c.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: products } = await supabase
      .from("products")
      .select("category_id")
      .eq("client_id", clientId)
      .in("category_id", ids)
      .neq("status", "ARCHIVED");
    for (const p of products ?? []) {
      const id = p.category_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return {
    categories: (data ?? []).map((c) => ({ ...c, product_count: counts.get(c.id as string) ?? 0 })),
  };
}

export async function createCategory(
  clientId: string,
  input: { name: string; parent_id?: string | null; sort_order?: number }
) {
  const name = input.name.trim();
  if (!name) return { error: "Name is required", status: 400 as const };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      client_id: clientId,
      name,
      parent_id: input.parent_id || null,
      sort_order: input.sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error) return { error: error.message, status: 500 as const };
  return { category: data };
}

export async function updateCategory(
  clientId: string,
  categoryId: string,
  input: { name?: string; parent_id?: string | null; sort_order?: number; status?: "ACTIVE" | "INACTIVE" }
) {
  const supabase = createAdminClient();
  if (input.parent_id === categoryId) return { error: "Category cannot be its own parent", status: 400 as const };
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;
  if (input.status) updates.status = input.status;
  const { data, error } = await supabase
    .from("product_categories")
    .update(updates)
    .eq("id", categoryId)
    .eq("client_id", clientId)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { category: data };
}

export async function deactivateCategory(clientId: string, categoryId: string) {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("category_id", categoryId)
    .neq("status", "ARCHIVED");
  if ((count ?? 0) > 0) {
    return { error: "Reassign products before deactivating this category", status: 409 as const, product_count: count };
  }
  return updateCategory(clientId, categoryId, { status: "INACTIVE" });
}
