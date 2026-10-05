import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOperationsAttention, listSalesFocus } from "@/lib/intelligence/facts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (auth.role !== "CLIENT_MANAGER" && auth.role !== "SUPER_ADMIN" && auth.role !== "SALESPERSON") {
    return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  }
  const actor = { userId: auth.userId, role: auth.role, clientId: auth.clientId };
  const supabase = createAdminClient();
  const [attention, focus, actions, usage] = await Promise.all([
    auth.role === "SALESPERSON" ? listSalesFocus(actor) : listOperationsAttention(actor),
    listSalesFocus(actor),
    supabase
      .from("ai_action_log")
      .select("id, tool_name, risk_level, result_summary, status, approval_required, created_at")
      .eq("client_id", auth.clientId)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("client_id", auth.clientId)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);
  return NextResponse.json({
    attention,
    salesFocus: auth.role === "SALESPERSON" ? focus : [],
    actions: actions.data ?? [],
    requestsToday: usage.count ?? 0,
  });
}
