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
  const countOnly = searchParams.get("count") === "1";

  const supabase = createAdminClient();

  if (countOnly) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false);
    return NextResponse.json({ unread: count ?? 0 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, message, read, created_at, lead_id")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId)
    .eq("read", false);

  return NextResponse.json({ notifications: data ?? [], unread: unread ?? 0 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ids?: string[]; all?: boolean } = {};
  try {
    body = (await req.json()) as { ids?: string[]; all?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (body.all) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", session.userId)
      .eq("read", false);
  } else if (body.ids && body.ids.length > 0) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", session.userId)
      .in("id", body.ids);
  }

  return NextResponse.json({ success: true });
}
