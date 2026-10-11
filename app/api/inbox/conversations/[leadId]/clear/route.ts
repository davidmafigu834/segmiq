import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canModifyLead(params.leadId, req);
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, name")
    .eq("id", params.leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = access.allowed;
  if (!allowed) {
    const session = await getAuthFromRequest(req);
    allowed = session?.role === "CLIENT_MANAGER" && session.clientId === lead.client_id;
  }
  if (!allowed) {
    const status = access.allowed ? 403 : access.status;
    return NextResponse.json({ error: access.allowed ? "Forbidden" : access.reason }, { status });
  }

  const clientId = lead.client_id as string;
  const leadId = lead.id as string;
  const removed = await supabase.from("whatsapp_messages").delete({ count: "exact" }).eq("lead_id", leadId).eq("client_id", clientId);
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  const sentCopies = await supabase
    .from("message_logs")
    .delete({ count: "exact" })
    .eq("lead_id", leadId)
    .eq("channel", "whatsapp")
    .eq("notification_type", "WHATSAPP_SESSION");
  if (sentCopies.error) return NextResponse.json({ error: sentCopies.error.message }, { status: 500 });
  await supabase.from("lead_events").delete().eq("lead_id", leadId).in("event_type", ["MESSAGE_SENT", "MESSAGE_RECEIVED"]);
  await supabase.from("sales_copilot_work_items").delete().eq("lead_id", leadId).eq("client_id", clientId);
  await supabase.from("sales_copilot_analyses").delete().eq("lead_id", leadId).eq("client_id", clientId);
  await supabase.from("sales_copilot_jobs").delete().eq("lead_id", leadId).eq("client_id", clientId);
  await supabase.from("call_logs").delete().eq("lead_id", leadId).like("notes", "Sales Copilot reminder:%");

  return NextResponse.json({
    ok: true,
    name: lead.name,
    messagesRemoved: (removed.count ?? 0) + (sentCopies.count ?? 0),
  });
}
