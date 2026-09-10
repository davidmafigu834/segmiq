import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Safe account security metadata for the Security settings page. */
export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("password_changed_at, email")
    .eq("id", g.session.userId)
    .maybeSingle();

  return NextResponse.json({
    passwordChangedAt: data?.password_changed_at ?? null,
  });
}
