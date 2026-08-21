import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReassignLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { isRoundRobinEligibleUserId } from "@/lib/auth/sales-capabilities";
import { SUPPORT_REASON_LABEL } from "@/lib/inbox/conversation-type";

const bodySchema = z.object({
  destination: z.enum(["team", "person"]),
  assigned_to_id: z.string().uuid().nullable().optional(),
  reason_category: z.enum([
    "TECHNICAL",
    "INSTALLATION",
    "WARRANTY",
    "CUSTOMER_SERVICE",
    "OTHER",
  ]),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  keep_collaborator: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, client_id, assigned_to_id, contact_id, whatsapp_collaborator_ids, source"
    )
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead || lead.source !== "WHATSAPP_INBOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clientId = lead.client_id as string;
  const isManager = canReassignLeads(session, clientId);
  if (!isManager) {
    const access = await canModifyLead(params.leadId, req);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }
  }

  const body = parsed.data;
  let nextAssigneeId: string | null = (lead.assigned_to_id as string | null) ?? null;
  if (body.destination === "person") {
    if (!body.assigned_to_id) {
      return NextResponse.json({ error: "Select a person" }, { status: 400 });
    }
    const eligible = await isRoundRobinEligibleUserId(supabase, clientId, body.assigned_to_id);
    if (!eligible) return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
    nextAssigneeId = body.assigned_to_id;
  }

  const collaborators = Array.isArray(lead.whatsapp_collaborator_ids)
    ? [...(lead.whatsapp_collaborator_ids as string[])]
    : [];
  if (body.keep_collaborator && session.userId && !collaborators.includes(session.userId)) {
    collaborators.push(session.userId);
  }

  const now = new Date().toISOString();
  const { error: leadError } = await supabase
    .from("leads")
    .update({
      whatsapp_conversation_type: "SUPPORT",
      whatsapp_queue: "SUPPORT",
      assigned_to_id: nextAssigneeId,
      whatsapp_collaborator_ids: collaborators,
      whatsapp_conversation_status: "OPEN",
      updated_at: now,
    })
    .eq("id", params.leadId)
    .eq("client_id", clientId);

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });

  const { data: existingCase } = await supabase
    .from("support_cases")
    .select("id")
    .eq("lead_id", params.leadId)
    .neq("status", "RESOLVED")
    .maybeSingle();

  let supportCaseId = existingCase?.id as string | undefined;
  if (!supportCaseId) {
    const { data: created, error: caseError } = await supabase
      .from("support_cases")
      .insert({
        client_id: clientId,
        lead_id: params.leadId,
        contact_id: (lead.contact_id as string | null) ?? null,
        status: "OPEN",
        reason_category: body.reason_category,
        reason: body.reason?.trim() || SUPPORT_REASON_LABEL[body.reason_category],
        notes: body.notes?.trim() || null,
        opened_by_id: session.userId,
        assigned_to_id: nextAssigneeId,
        updated_at: now,
      })
      .select("id")
      .single();
    if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });
    supportCaseId = created.id as string;
  }

  const { data: actorUser } = await supabase
    .from("users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();
  const actor = {
    id: session.userId,
    name: (actorUser?.name as string | null) ?? "Unknown",
    role: session.role ?? "SALESPERSON",
  };

  await logLeadEvent({
    leadId: params.leadId,
    clientId,
    actor,
    eventType: "CONVERSATION_TRANSFERRED_TO_SUPPORT",
    eventData: {
      to_name: body.destination === "team" ? "Support Team" : "Support",
      reason: body.reason?.trim() || SUPPORT_REASON_LABEL[body.reason_category],
      reason_category: body.reason_category,
      keep_collaborator: Boolean(body.keep_collaborator),
      assigned_to_id: nextAssigneeId,
    },
    channel: "whatsapp",
  });

  if (!existingCase) {
    await logLeadEvent({
      leadId: params.leadId,
      clientId,
      actor,
      eventType: "SUPPORT_CASE_OPENED",
      eventData: {
        support_case_id: supportCaseId,
        reason_category: body.reason_category,
        reason: body.reason?.trim() || SUPPORT_REASON_LABEL[body.reason_category],
      },
      channel: "whatsapp",
    });
  }

  return NextResponse.json({ ok: true, supportCaseId });
}
