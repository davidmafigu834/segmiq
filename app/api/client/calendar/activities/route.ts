import { NextResponse } from "next/server";
import { z } from "zod";
import { background } from "@/lib/background";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canReassignLeads } from "@/lib/auth/permissions";
import { isRoundRobinEligibleUserId } from "@/lib/auth/sales-capabilities";
import {
  logFollowUpCompleted,
  logFollowUpSet,
  logLeadReassigned,
} from "@/lib/lead-events";
import { createAdminClient } from "@/lib/supabase/admin";

const activityPatchSchema = z.object({
  leadId: z.string().uuid(),
  followUpDate: z.string().refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid follow-up date"
  ).nullable(),
  ownerId: z.string().uuid().optional(),
});

export async function PATCH(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.role !== "CLIENT_MANAGER" && auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = activityPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activity update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, follow_up_date")
    .eq("id", parsed.data.leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const clientId = lead.client_id as string;
  if (!canReassignLeads(auth, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.ownerId) {
    const eligible = await isRoundRobinEligibleUserId(
      supabase,
      clientId,
      parsed.data.ownerId
    );
    if (!eligible) {
      return NextResponse.json(
        { error: "The selected owner is not an active salesperson for this company" },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {
    follow_up_date: parsed.data.followUpDate,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.ownerId !== undefined) updates.assigned_to_id = parsed.data.ownerId;

  const { data: updated, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", parsed.data.leadId)
    .eq("client_id", clientId)
    .select("id, assigned_to_id, follow_up_date")
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: "Could not update the activity" }, { status: 500 });
  }

  const { data: actorUser } = await supabase
    .from("users")
    .select("name")
    .eq("id", auth.userId)
    .maybeSingle();
  const actor = {
    id: auth.userId,
    name: (actorUser?.name as string | null) || "Company manager",
    role: auth.role,
  };

  if (parsed.data.ownerId && parsed.data.ownerId !== lead.assigned_to_id) {
    background("companyCalendarLeadReassigned", async () => {
      const ownerIds = [lead.assigned_to_id, parsed.data.ownerId].filter(Boolean) as string[];
      const { data: ownerRows } = await supabase
        .from("users")
        .select("id, name")
        .in("id", ownerIds);
      const names = new Map(
        (ownerRows ?? []).map((row) => [row.id as string, (row.name as string | null) || "Team member"])
      );
      await logLeadReassigned({
        leadId: parsed.data.leadId,
        clientId,
        actor,
        fromId: (lead.assigned_to_id as string | null) ?? null,
        fromName: lead.assigned_to_id ? names.get(lead.assigned_to_id as string) ?? "Team member" : "Unassigned",
        toId: parsed.data.ownerId ?? null,
        toName: names.get(parsed.data.ownerId!) ?? "Team member",
        handoverNotes: "Reassigned while scheduling a Company Calendar activity.",
      });
    });
  }

  if (parsed.data.followUpDate === null && lead.follow_up_date != null) {
    background("companyCalendarFollowUpCompleted", () =>
      logFollowUpCompleted({
        leadId: parsed.data.leadId,
        clientId,
        actor,
        previousFollowUpDate: lead.follow_up_date as string,
      })
    );
  } else if (
    parsed.data.followUpDate &&
    parsed.data.followUpDate !== lead.follow_up_date
  ) {
    background("companyCalendarFollowUpSet", () =>
      logFollowUpSet({
        leadId: parsed.data.leadId,
        clientId,
        actor,
        followUpDate: parsed.data.followUpDate!,
      })
    );
  }

  return NextResponse.json({ activity: updated });
}
