import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Lists clients available to the signed-in field-app user (Bearer or cookie). */
export async function GET(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (auth.role === "SUPER_ADMIN") {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, slug")
      .eq("is_active", true)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (!auth.clientId) {
    return NextResponse.json(
      { error: "No Cloud client is linked to this account." },
      { status: 400 }
    );
  }

  const { data } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("id", auth.clientId)
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json(data ? [data] : []);
}
