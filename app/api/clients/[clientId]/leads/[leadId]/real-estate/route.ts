import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient, canModifyLead, canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRealEstateInquiryWorkspace } from "@/lib/sales/get-real-estate-inquiry-workspace";
import {
  isReManualStage,
  leadStatusForReStage,
  withMarkedInterested,
} from "@/lib/real-estate/pipeline";
import { logReActivity } from "@/lib/lead-events";
import { isRealEstate } from "@/lib/terminology";
import { appendInterestedListingIds } from "@/lib/real-estate/helpers";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; leadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!isRealEstate(client?.business_type)) {
    return NextResponse.json({ error: "Not a real-estate workspace" }, { status: 403 });
  }

  const workspace = await getRealEstateInquiryWorkspace({
    clientId: params.clientId,
    leadId: params.leadId,
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ workspace });
}

const patchSchema = z.object({
  stage: z.string().optional(),
  linked_listing_id: z.string().uuid().nullable().optional(),
  interested_listing_id: z.string().uuid().optional(),
  deal_side: z.enum(["buy_side", "sell_side", "landlord_side", "tenant_side"]).nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
  project_type: z.string().max(120).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; leadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const check = await canModifyLead(params.leadId, req);
  const managerOfCompany =
    session.role === "SUPER_ADMIN" ||
    (session.role === "CLIENT_MANAGER" && session.clientId === params.clientId);
  if (!check.allowed && !managerOfCompany) {
    return NextResponse.json(
      { error: check.allowed ? "Forbidden" : check.reason },
      { status: check.allowed ? 403 : check.status }
    );
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, status, form_data, linked_listing_id, contact_id")
    .eq("id", params.leadId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let activitySummary: string | null = null;
  let activityKind:
    | "stage_changed"
    | "property_linked"
    | "property_matched"
    | null = null;

  if (parsed.data.deal_side !== undefined) updates.deal_side = parsed.data.deal_side;
  if (parsed.data.follow_up_date !== undefined) updates.follow_up_date = parsed.data.follow_up_date;
  if (parsed.data.project_type !== undefined) updates.project_type = parsed.data.project_type;

  if (parsed.data.linked_listing_id !== undefined) {
    if (parsed.data.linked_listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("id")
        .eq("id", parsed.data.linked_listing_id)
        .eq("client_id", params.clientId)
        .maybeSingle();
      if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    updates.linked_listing_id = parsed.data.linked_listing_id;
    activityKind = "property_linked";
    activitySummary = parsed.data.linked_listing_id
      ? "Linked a property to this inquiry"
      : "Cleared the linked property";
  }

  if (parsed.data.stage) {
    if (!isReManualStage(parsed.data.stage)) {
      return NextResponse.json(
        { error: "That stage is driven by matching, viewings or offers. Complete the related action instead." },
        { status: 400 }
      );
    }
    updates.status = leadStatusForReStage(parsed.data.stage);
    updates.form_data = withMarkedInterested(
      (lead.form_data as Record<string, unknown> | null) ?? {},
      parsed.data.stage === "interested"
    );
    activityKind = "stage_changed";
    activitySummary = `Stage set to ${parsed.data.stage.replace(/_/g, " ")}`;
  }

  if (parsed.data.interested_listing_id) {
    if (!lead.contact_id) {
      return NextResponse.json({ error: "Inquiry has no contact" }, { status: 400 });
    }
    const { data: listing } = await supabase
      .from("listings")
      .select("id")
      .eq("id", parsed.data.interested_listing_id)
      .eq("client_id", params.clientId)
      .maybeSingle();
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    const { data: contact } = await supabase
      .from("contacts")
      .select("interested_listing_ids")
      .eq("id", lead.contact_id as string)
      .eq("client_id", params.clientId)
      .maybeSingle();
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    const nextIds = appendInterestedListingIds(
      contact.interested_listing_ids,
      parsed.data.interested_listing_id
    );
    await supabase
      .from("contacts")
      .update({ interested_listing_ids: nextIds, updated_at: new Date().toISOString() })
      .eq("id", lead.contact_id as string);
    activityKind = "property_matched";
    activitySummary = "Marked a property as interested";
  }

  const { error } = await supabase.from("leads").update(updates).eq("id", params.leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (activityKind && activitySummary) {
    await logReActivity({
      leadId: params.leadId,
      clientId: params.clientId,
      actor: {
        id: session.userId,
        name: session.user?.name ?? "Agent",
        role: session.role,
      },
      summary: activitySummary,
      kind: activityKind,
    });
  }

  const workspace = await getRealEstateInquiryWorkspace({
    clientId: params.clientId,
    leadId: params.leadId,
  });
  return NextResponse.json({ workspace });
}
