import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { logLeadReassigned } from "@/lib/lead-events";

const bodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  assigned_to_id: z.string().uuid().nullable(),
  handover_notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { leadIds, assigned_to_id, handover_notes } = parsed.data;
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const actorId = check.userId;

  // Fetch actor name once for event logging
  const { data: actorUser } = await supabase.from("users").select("name").eq("id", actorId).maybeSingle();
  const actorName = (actorUser as { name: string } | null)?.name || "Unknown";
  const actor = { id: actorId, name: actorName, role: "AGENCY_ADMIN" as const };

  // Fetch new assignee name once for event logging
  let newAssigneeName = "Unassigned";
  if (assigned_to_id) {
    const { data: newAssignee } = await supabase.from("users").select("name").eq("id", assigned_to_id).maybeSingle();
    if (newAssignee) newAssigneeName = (newAssignee as { name: string }).name;
  }

  for (const leadId of leadIds) {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("client_id, assigned_to_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!leadRow?.client_id) {
      return NextResponse.json({ error: `Lead not found: ${leadId}` }, { status: 404 });
    }
    const clientId = leadRow.client_id as string;
    const prevAssigneeId = (leadRow.assigned_to_id as string | null) ?? null;

    if (assigned_to_id === null) {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to_id: null, updated_at: now })
        .eq("id", leadId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { data: assignee } = await supabase
        .from("users")
        .select("id")
        .eq("id", assigned_to_id)
        .eq("client_id", clientId)
        .eq("role", "SALESPERSON")
        .eq("is_active", true)
        .maybeSingle();
      if (!assignee) {
        return NextResponse.json(
          { error: `Assignee is not an active salesperson for lead ${leadId}'s client` },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to_id, updated_at: now })
        .eq("id", leadId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log reassignment event (fire-and-forget)
    if (prevAssigneeId !== assigned_to_id) {
      const capturedPrevId = prevAssigneeId;
      background("logLeadReassigned", async () => {
        let fromName = "Unassigned";
        if (capturedPrevId) {
          const { data: u } = await supabase.from("users").select("name").eq("id", capturedPrevId).maybeSingle();
          if (u) fromName = (u as { name: string }).name;
        }
        await logLeadReassigned({
          leadId,
          clientId,
          actor,
          fromId: capturedPrevId,
          fromName,
          toId: assigned_to_id,
          toName: newAssigneeName,
          handoverNotes: handover_notes ?? null,
        });
      });
    }
  }

  return NextResponse.json({ ok: true, updated: leadIds.length });
}
