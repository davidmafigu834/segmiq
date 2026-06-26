import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await createAdminClient()
    .from("notifications")
    .update({ read: true })
    .eq("user_id", auth.userId)
    .eq("read", false);

  if (error) {
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
