import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { logStatusChanged, logLeadReassigned, logFollowUpSet } from "@/lib/lead-events";
import { recordWinAnalysis } from "@/lib/win-analysis";
import type { LeadStatus } from "@/types";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: { leadId: string } }) {
  const access = await canReadLead(params.leadId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*, clients ( name, industry )")
    .eq("id", params.leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

const patchSchema = z.object({
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "NEGOTIATING",
      "PROPOSAL_SENT",
      "WON",
      "LOST",
      "NOT_QUALIFIED",
    ])
    .optional(),
  follow_up_date: z.string().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  is_archived: z.boolean().optional(),
  handover_notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { leadId: string } }) {
  const check = await canModifyLead(params.leadId);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const session = await getServerSession(authOptions);
  const isAgency = session?.role === "AGENCY_ADMIN";

  if ((parsed.data.assigned_to_id !== undefined || parsed.data.is_archived !== undefined) && !isAgency) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Fetch previous lead state for event logging
  const { data: previousLead } = await supabase
    .from("leads")
    .select("client_id, status, assigned_to_id, follow_up_date")
    .eq("id", params.leadId)
    .maybeSingle();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status) updates.status = parsed.data.status as LeadStatus;
  if (parsed.data.follow_up_date !== undefined) updates.follow_up_date = parsed.data.follow_up_date;
  if (parsed.data.assigned_to_id !== undefined && isAgency) {
    if (parsed.data.assigned_to_id === null) {
      updates.assigned_to_id = null;
    } else {
      const { data: assignee } = await supabase
        .from("users")
        .select("id")
        .eq("id", parsed.data.assigned_to_id)
        .eq("client_id", previousLead?.client_id as string)
        .eq("role", "SALESPERSON")
        .eq("is_active", true)
        .maybeSingle();
      if (!assignee) {
        return NextResponse.json({ error: "Invalid assignee for this client" }, { status: 400 });
      }
      updates.assigned_to_id = parsed.data.assigned_to_id;
    }
  }
  if (parsed.data.is_archived !== undefined && isAgency) {
    updates.is_archived = parsed.data.is_archived;
  }

  const { data: updated } = await supabase.from("leads").update(updates).eq("id", params.leadId).select("*").single();

  // Event logging (fire-and-forget — never blocks the response)
  if (updated && previousLead && session?.userId) {
    const clientId = previousLead.client_id as string;
    const actorId = session.userId;
    const actorName = session.user?.name || "Unknown";
    const actorRole = session.role || "UNKNOWN";
    const actor = { id: actorId, name: actorName, role: actorRole };

    if (parsed.data.status && parsed.data.status !== previousLead.status) {
      background("logStatusChanged", () =>
        logStatusChanged({
          leadId: params.leadId,
          clientId,
          actor,
          fromStatus: previousLead.status as string,
          toStatus: parsed.data.status as string,
        })
      );

      if (parsed.data.status === "WON" && previousLead.status !== "WON") {
        background("recordWinAnalysis", () => recordWinAnalysis(params.leadId));
      }
    }

    if (
      isAgency &&
      parsed.data.assigned_to_id !== undefined &&
      parsed.data.assigned_to_id !== previousLead.assigned_to_id
    ) {
      background("logLeadReassigned", async () => {
        const prevAssigneeId = previousLead.assigned_to_id as string | null;
        const newAssigneeId = parsed.data.assigned_to_id ?? null;
        let fromName = "Unassigned";
        let toName = "Unassigned";
        if (prevAssigneeId) {
          const { data: u } = await supabase.from("users").select("name").eq("id", prevAssigneeId).maybeSingle();
          if (u) fromName = (u as { name: string }).name;
        }
        if (newAssigneeId) {
          const { data: u } = await supabase.from("users").select("name").eq("id", newAssigneeId).maybeSingle();
          if (u) toName = (u as { name: string }).name;
        }
        await logLeadReassigned({
          leadId: params.leadId,
          clientId,
          actor,
          fromId: prevAssigneeId,
          fromName,
          toId: newAssigneeId,
          toName,
          handoverNotes: parsed.data.handover_notes ?? null,
        });
      });
    }

    if (
      parsed.data.follow_up_date &&
      parsed.data.follow_up_date !== previousLead.follow_up_date
    ) {
      background("logFollowUpSet", () =>
        logFollowUpSet({
          leadId: params.leadId,
          clientId,
          actor,
          followUpDate: parsed.data.follow_up_date as string,
        })
      );
    }
  }

  return NextResponse.json({ lead: updated });
}
