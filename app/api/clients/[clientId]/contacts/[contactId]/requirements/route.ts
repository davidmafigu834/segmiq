import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient, canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logReActivity } from "@/lib/lead-events";
import { isRealEstate } from "@/lib/terminology";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lead_id: z.string().uuid().optional(),
  buyer_budget_min: z.number().nonnegative().nullable().optional(),
  buyer_budget_max: z.number().nonnegative().nullable().optional(),
  buyer_bedrooms_wanted: z.number().int().min(0).max(20).nullable().optional(),
  buyer_area_preference: z.string().max(400).nullable().optional(),
  buyer_timeline: z.string().max(80).nullable().optional(),
  property_type: z.string().max(120).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; contactId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!isRealEstate(client?.business_type)) {
    return NextResponse.json({ error: "Not a real-estate workspace" }, { status: 403 });
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, client_id")
    .eq("id", params.contactId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  if (parsed.data.lead_id) {
    const check = await canModifyLead(parsed.data.lead_id, req);
    const managerOfCompany =
      session.role === "SUPER_ADMIN" ||
      (session.role === "CLIENT_MANAGER" && session.clientId === params.clientId);
    if (!check.allowed && !managerOfCompany) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data: lead } = await supabase
      .from("leads")
      .select("id, contact_id, form_data")
      .eq("id", parsed.data.lead_id)
      .eq("client_id", params.clientId)
      .maybeSingle();
    if (!lead || lead.contact_id !== params.contactId) {
      return NextResponse.json({ error: "Lead does not belong to this contact" }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const body = parsed.data;
  if (body.buyer_budget_min !== undefined) update.buyer_budget_min = body.buyer_budget_min;
  if (body.buyer_budget_max !== undefined) update.buyer_budget_max = body.buyer_budget_max;
  if (body.buyer_bedrooms_wanted !== undefined) update.buyer_bedrooms_wanted = body.buyer_bedrooms_wanted;
  if (body.buyer_area_preference !== undefined) {
    update.buyer_area_preference = body.buyer_area_preference?.trim() || null;
  }
  if (body.buyer_timeline !== undefined) update.buyer_timeline = body.buyer_timeline?.trim() || null;

  const { error } = await supabase.from("contacts").update(update).eq("id", params.contactId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.lead_id) {
    if (body.property_type !== undefined || body.notes !== undefined) {
      const { data: lead } = await supabase
        .from("leads")
        .select("form_data, project_type")
        .eq("id", parsed.data.lead_id)
        .maybeSingle();
      const formData = { ...((lead?.form_data as Record<string, unknown> | null) ?? {}) };
      const current = { ...((formData.re_requirements as Record<string, unknown> | undefined) ?? {}) };
      if (body.property_type !== undefined) current.propertyType = body.property_type;
      if (body.notes !== undefined) current.notes = body.notes;
      formData.re_requirements = current;
      const leadUpdate: Record<string, unknown> = {
        form_data: formData,
        updated_at: new Date().toISOString(),
      };
      if (body.property_type !== undefined) leadUpdate.project_type = body.property_type;
      await supabase.from("leads").update(leadUpdate).eq("id", parsed.data.lead_id);
    }

    await logReActivity({
      leadId: parsed.data.lead_id,
      clientId: params.clientId,
      actor: {
        id: session.userId,
        name: session.user?.name ?? "Agent",
        role: session.role,
      },
      summary: "Updated property requirements",
      kind: "requirements_updated",
    });
  }

  return NextResponse.json({ ok: true });
}
