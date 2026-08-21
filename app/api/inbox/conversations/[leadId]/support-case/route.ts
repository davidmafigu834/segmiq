import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReassignLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { parseSupportCaseStatus } from "@/lib/inbox/conversation-type";

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

async function assertAccess(leadId: string, req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, contact_id, source")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || lead.source !== "WHATSAPP_INBOUND") {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const isManager = canReassignLeads(session, lead.client_id as string);
  if (!isManager) {
    const access = await canModifyLead(leadId, req);
    if (!access.allowed) {
      return { error: NextResponse.json({ error: access.reason }, { status: access.status }) };
    }
  }
  return { session, supabase, lead };
}

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await assertAccess(params.leadId, req);
  if ("error" in access && access.error) return access.error;
  const { supabase } = access;

  const { data } = await supabase
    .from("support_cases")
    .select("*")
    .eq("lead_id", params.leadId)
    .order("created_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    cases: (data ?? []).map((row) => ({
      id: row.id,
      status: parseSupportCaseStatus(row.status),
      reasonCategory: row.reason_category,
      reason: row.reason,
      notes: row.notes,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    })),
  });
}

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const access = await assertAccess(params.leadId, req);
  if ("error" in access && access.error) return access.error;
  const { session, supabase, lead } = access;

  const { data: existing } = await supabase
    .from("support_cases")
    .select("id, status")
    .eq("lead_id", params.leadId)
    .neq("status", "RESOLVED")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ case: existing, alreadyOpen: true });
  }

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("support_cases")
    .insert({
      client_id: lead.client_id,
      lead_id: params.leadId,
      contact_id: lead.contact_id,
      status: "OPEN",
      opened_by_id: session.userId,
      assigned_to_id: lead.assigned_to_id,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: { id: session.userId, name: session.user?.name ?? "Unknown", role: session.role ?? "SALESPERSON" },
    eventType: "SUPPORT_CASE_OPENED",
    eventData: { support_case_id: created.id },
    channel: "whatsapp",
  });

  await supabase
    .from("leads")
    .update({
      whatsapp_conversation_type: "SUPPORT",
      whatsapp_queue: "SUPPORT",
      updated_at: now,
    })
    .eq("id", params.leadId);

  return NextResponse.json({ case: created }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { leadId: string } }) {
  const access = await assertAccess(params.leadId, req);
  if ("error" in access && access.error) return access.error;
  const { session, supabase, lead } = access;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { data: current } = await supabase
    .from("support_cases")
    .select("id, status")
    .eq("lead_id", params.leadId)
    .neq("status", "RESOLVED")
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "No open support case" }, { status: 404 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (parsed.data.status) {
    patch.status = parsed.data.status;
    patch.resolved_at = parsed.data.status === "RESOLVED" ? now : null;
    patch.resolved_by_id = parsed.data.status === "RESOLVED" ? session.userId : null;
  }
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.reason !== undefined) patch.reason = parsed.data.reason;

  const { error } = await supabase.from("support_cases").update(patch).eq("id", current.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: { id: session.userId, name: session.user?.name ?? "Unknown", role: session.role ?? "SALESPERSON" },
    eventType: "SUPPORT_CASE_UPDATED",
    eventData: { support_case_id: current.id, ...parsed.data },
    channel: "whatsapp",
  });

  return NextResponse.json({ ok: true });
}
