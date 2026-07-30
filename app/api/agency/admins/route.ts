import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, is_active, created_at")
    .eq("role", "SUPER_ADMIN")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ admins: data ?? [] });
}
