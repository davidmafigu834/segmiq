import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReassignLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadReassigned } from "@/lib/lead-events";
import { notifyBulkReassignment } from "@/lib/notifications";
import { background } from "@/lib/background";

const bodySchema = z.object({
  assigned_to_id: z.string().uuid(),
  handover_notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id")
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clientId = lead.client_id as string;
  const isManager = canReassignLeads(session, clientId);
  const access = await canModifyLead(params.leadId, req);

  if (!isManager) {
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }
    if (access.lead.assigned_to_id !== session.userId) {
      return NextResponse.json({ error: "Only the assigned rep can transfer this conversation" }, { status: 403 });
    }
  }

  const { assigned_to_id, handover_notes } = parsed.data;
  if (assigned_to_id === session.userId) {
    return NextResponse.json({ error: "Already assigned to you" }, { status: 400 });
  }

  const { data: assignee } = await supabase
    .from("users")
    .select("id, name")
    .eq("id", assigned_to_id)
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .maybeSingle();

  if (!assignee) {
    return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
  }

  const prevAssigneeId = (lead.assigned_to_id as string | null) ?? null;
  if (prevAssigneeId === assigned_to_id) {
    return NextResponse.json({ ok: true, updated: false });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to_id, updated_at: now })
    .eq("id", params.leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: actorUser } = await supabase.from("users").select("name").eq("id", session.userId).maybeSingle();
  const actor = {
    id: session.userId,
    name: (actorUser as { name: string } | null)?.name ?? "Unknown",
    role: session.role ?? "SALESPERSON",
  };

  let fromName = "Unassigned";
  if (prevAssigneeId) {
    const { data: prevUser } = await supabase.from("users").select("name").eq("id", prevAssigneeId).maybeSingle();
    if (prevUser) fromName = (prevUser as { name: string }).name;
  }

  await logLeadReassigned({
    leadId: params.leadId,
    clientId,
    actor,
    fromId: prevAssigneeId,
    fromName,
    toId: assigned_to_id,
    toName: (assignee as { name: string }).name,
    handoverNotes: handover_notes ?? null,
  });

  background("notifyTransfer", async () => {
    await notifyBulkReassignment({
      clientId,
      leadIds: [params.leadId],
      actorId: session.userId,
    });
  });

  return NextResponse.json({ ok: true, updated: true });
}
