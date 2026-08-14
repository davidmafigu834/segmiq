import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReassignLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";

const bodySchema = z.object({ status: z.enum(["OPEN", "RESOLVED"]) });

export async function PATCH(req: Request, { params }: { params: { leadId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, source, whatsapp_conversation_status")
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead || lead.source !== "WHATSAPP_INBOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const managerAllowed = canReassignLeads(session, lead.client_id as string);
  if (session.role === "CLIENT_MANAGER" && !managerAllowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!managerAllowed) {
    const modify = await canModifyLead(params.leadId, req);
    if (!modify.allowed) {
      return NextResponse.json({ error: modify.reason }, { status: modify.status });
    }
  }

  const status = parsed.data.status;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leads")
    .update({
      whatsapp_conversation_status: status,
      whatsapp_resolved_at: status === "RESOLVED" ? now : null,
      whatsapp_resolved_by_id: status === "RESOLVED" ? session.userId : null,
      updated_at: now,
    })
    .eq("id", params.leadId)
    .eq("client_id", lead.client_id as string);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: actor } = await supabase
    .from("users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();
  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: {
      id: session.userId,
      name: (actor?.name as string | null) ?? "Unknown",
      role: session.role ?? "UNKNOWN",
    },
    eventType: status === "RESOLVED" ? "CONVERSATION_RESOLVED" : "CONVERSATION_REOPENED",
    eventData: {
      from: (lead.whatsapp_conversation_status as string | null) ?? "OPEN",
      to: status,
    },
    channel: "whatsapp",
  });

  return NextResponse.json({ ok: true, status });
}
