import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "15", 10) || 15, 50);

  if (auth.clientId) {
    const { loadDemoDatasetForClient } = await import("@/lib/demo/provider");
    const demo = await loadDemoDatasetForClient(auth.clientId);
    if (demo) {
      const { demoNotificationsFor } = await import("@/lib/demo/adapters/workspace-views");
      const rows = demoNotificationsFor(demo, auth.userId);
      return NextResponse.json({
        notifications: rows.slice(0, limit),
        unreadCount: rows.filter((row) => !row.read).length,
      });
    }
  }

  const supabase = createAdminClient();

  const { count: unreadCount, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .eq("read", false);

  if (countError) {
    console.error("[notifications GET count]", countError.message);
  }

  let { data, error } = await supabase
    .from("notifications")
    .select("id, type, message, read, lead_id, client_id, quotation_id, weekly_report_id, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const withQuote = await supabase
      .from("notifications")
      .select("id, type, message, read, lead_id, client_id, quotation_id, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!withQuote.error) {
      data = (withQuote.data ?? []).map((row) => ({ ...row, weekly_report_id: null })) as typeof data;
      error = null;
    } else {
      const fallback = await supabase
        .from("notifications")
        .select("id, type, message, read, lead_id, client_id, created_at")
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      data = (fallback.data ?? []).map((row) => ({ ...row, quotation_id: null, weekly_report_id: null })) as typeof data;
      error = fallback.error;
    }
  }

  if (error) {
    console.error("[notifications GET]", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message || "Failed to load notifications" }, { status: 500 });
  }

  return NextResponse.json({
    notifications: data ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
