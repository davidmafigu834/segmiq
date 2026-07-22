import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReassignLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { logLeadReassigned } from "@/lib/lead-events";
import { notifyBulkReassignment } from "@/lib/notifications";
import { isRoundRobinEligibleUserId } from "@/lib/auth/sales-capabilities";

const bodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  assigned_to_id: z.string().uuid().nullable(),
  handover_notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { leadIds, assigned_to_id, handover_notes } = parsed.data;
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const actorId = session.userId;

  let enforcedClientId: string | null = null;

  // Fetch actor name once for event logging
  const { data: actorUser } = await supabase.from("users").select("name").eq("id", actorId).maybeSingle();
  const actorName = (actorUser as { name: string } | null)?.name || "Unknown";
  const actorRole = session.role ?? "UNKNOWN";
  const actor = { id: actorId, name: actorName, role: actorRole };

  if (!leadIds.length) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }

  for (const leadId of leadIds) {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("client_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!leadRow?.client_id) {
      return NextResponse.json({ error: `Lead not found: ${leadId}` }, { status: 404 });
    }

    if (!enforcedClientId) {
      enforcedClientId = leadRow.client_id as string;
    }

    if (!canReassignLeads(session, leadRow.client_id as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (leadRow.client_id !== enforcedClientId) {
      return NextResponse.json({ error: "Cross-client reassignment is not allowed" }, { status: 403 });
    }
  }

  if (!enforcedClientId) {
    return NextResponse.json({ error: "Client scope could not be determined" }, { status: 400 });
  }

  if (!canReassignLeads(session, enforcedClientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (assigned_to_id) {
    const eligible = await isRoundRobinEligibleUserId(supabase, enforcedClientId, assigned_to_id);
    if (!eligible) {
      return NextResponse.json({ error: "Assignee is not an active salesperson for this client" }, { status: 400 });
    }
  }

  const results: { leadId: string; fromId: string | null; toId: string | null; updated: boolean }[] = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // Fetch new assignee name once for event logging
  let newAssigneeName = "Unassigned";
  if (assigned_to_id) {
    const { data: newAssignee } = await supabase
      .from("users")
      .select("name, notification_prefs, phone, email")
      .eq("id", assigned_to_id)
      .maybeSingle();
    if (newAssignee) newAssigneeName = (newAssignee as { name: string }).name;
  }

  const leadRows = await supabase
    .from("leads")
    .select("id, assigned_to_id, client_id")
    .in("id", leadIds)
    .eq("client_id", enforcedClientId);

  if (leadRows.error) {
    return NextResponse.json({ error: leadRows.error.message }, { status: 500 });
  }

  const rows = leadRows.data ?? [];
  const rowsById = new Map(rows.map((row) => [row.id as string, row]));

  for (const leadId of leadIds) {
    const row = rowsById.get(leadId);
    if (!row) {
      failedCount += 1;
      continue;
    }

    const prevAssigneeId = (row.assigned_to_id as string | null) ?? null;
    if (assigned_to_id && prevAssigneeId === assigned_to_id) {
      skippedCount += 1;
      results.push({ leadId, fromId: prevAssigneeId, toId: assigned_to_id, updated: false });
      continue;
    }

    const updatePayload = assigned_to_id === null
      ? { assigned_to_id: null, updated_at: now }
      : { assigned_to_id, updated_at: now };

    const { error } = await supabase.from("leads").update(updatePayload).eq("id", leadId);
    if (error) {
      failedCount += 1;
      continue;
    }

    updatedCount += 1;
    results.push({ leadId, fromId: prevAssigneeId, toId: assigned_to_id ?? null, updated: true });

    if (prevAssigneeId !== (assigned_to_id ?? null)) {
      const capturedPrevId = prevAssigneeId;
      background("logLeadReassigned", async () => {
        let fromName = "Unassigned";
        if (capturedPrevId) {
          const { data: u } = await supabase.from("users").select("name").eq("id", capturedPrevId).maybeSingle();
          if (u) fromName = (u as { name: string }).name;
        }
        await logLeadReassigned({
          leadId,
          clientId: enforcedClientId!,
          actor,
          fromId: capturedPrevId,
          fromName,
          toId: assigned_to_id ?? null,
          toName: newAssigneeName,
          handoverNotes: handover_notes ?? null,
        });
      });
    }
  }

  const updatedLeadIds = results.filter((r) => r.updated).map((r) => r.leadId);
  if (updatedLeadIds.length > 0) {
    background("notifyBulkReassignment", async () => {
      try {
        await notifyBulkReassignment({
          clientId: enforcedClientId!,
          leadIds: updatedLeadIds,
          actorId,
        });
      } catch (err) {
        console.error("[bulk-reassign] notify failed", err);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    updated: updatedCount,
    skipped: skippedCount,
    failed: failedCount,
  });
}
