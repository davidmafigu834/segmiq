import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadAssigned } from "@/lib/lead-events";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { leadId: string } }) {
  const g = await requireRoles(["SALESPERSON"]);
  if ("error" in g) return g.error;
  const { session } = g;

  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, is_archived, status")
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.is_archived) {
    return NextResponse.json({ error: "Lead is archived" }, { status: 400 });
  }

  if (lead.assigned_to_id) {
    return NextResponse.json({ error: "Lead is already assigned" }, { status: 409 });
  }

  const { data: rep } = await supabase
    .from("users")
    .select("id, client_id, name")
    .eq("id", session.userId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .maybeSingle();

  if (!rep || rep.client_id !== lead.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("assignment_mode")
    .eq("id", lead.client_id as string)
    .maybeSingle();

  const mode = (client?.assignment_mode as string | null) ?? "direct";
  if (mode !== "pool" && mode !== "direct") {
    return NextResponse.json(
      { error: "This client does not allow self-assignment from the pool" },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("leads")
    .update({ assigned_to_id: session.userId, updated_at: now })
    .eq("id", params.leadId)
    .is("assigned_to_id", null);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const actorName = (rep.name as string) ?? session.user?.name ?? "Unknown";
  await logLeadAssigned({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: { id: session.userId, name: actorName, role: "SALESPERSON" },
    assignedToId: session.userId,
    assignedToName: actorName,
  });

  const { data: updated } = await supabase
    .from("leads")
    .select("id, assigned_to_id")
    .eq("id", params.leadId)
    .single();

  return NextResponse.json({
    ok: true,
    assignedToId: updated?.assigned_to_id ?? session.userId,
    assignee: { id: session.userId, name: actorName },
  });
}
