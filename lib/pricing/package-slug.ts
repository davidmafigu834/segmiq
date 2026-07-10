import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export function slugifyPackageName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uniquePackageSlug(
  supabase: AdminClient,
  clientId: string,
  base: string,
  excludeId?: string
): Promise<string> {
  const root = base || "package";
  let candidate = root;
  let n = 2;

  while (true) {
    let query = supabase
      .from("pricing_packages")
      .select("id")
      .eq("client_id", clientId)
      .eq("slug", candidate);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${root}-${n++}`;
  }
}
