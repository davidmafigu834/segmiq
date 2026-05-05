import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "15", 10) || 15, 50);

  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("id, type, message, read, lead_id, client_id, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications GET]", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message || "Failed to load notifications" }, { status: 500 });
  }

  return NextResponse.json({ notifications: data ?? [] });
}
