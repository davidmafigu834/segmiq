import { NextResponse } from "next/server";
import { canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyConversationActivity, CompanyConversationContext } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

function activityLabel(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case "LEAD_ASSIGNED":
      return "Assigned conversation";
    case "LEAD_REASSIGNED":
      return "Reassigned conversation";
    case "MESSAGE_SENT":
      return "Sent WhatsApp reply";
    case "DOCUMENT_SENT":
      return "Sent sales asset";
    case "NOTE_ADDED":
      return "Added internal note";
    case "FOLLOW_UP_SET":
      return "Scheduled follow-up";
    case "FOLLOW_UP_COMPLETED":
      return "Completed follow-up";
    case "STATUS_CHANGED":
      return typeof data.to_status === "string"
        ? `Updated Lead to ${data.to_status.replace(/_/g, " ").toLowerCase()}`
        : "Updated Lead stage";
    case "DEAL_CREATED":
      return "Created Deal";
    case "QUOTE_SENT":
      return "Sent quotation";
    case "CONVERSATION_RESOLVED":
      return "Resolved conversation";
    case "CONVERSATION_REOPENED":
      return "Reopened conversation";
    default:
      return type.replace(/_/g, " ").toLowerCase();
  }
}

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();
  let leadResult = await supabase
    .from("leads")
    .select(
      "id, client_id, contact_id, active_deal_id, name, phone, email, created_at, whatsapp_conversation_status"
    )
    .eq("id", params.leadId)
    .maybeSingle();

  if (leadResult.error?.message.includes("whatsapp_conversation_status")) {
    leadResult = await supabase
      .from("leads")
      .select("id, client_id, contact_id, active_deal_id, name, phone, email, created_at")
      .eq("id", params.leadId)
      .maybeSingle();
  }

  const lead = leadResult.data;
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const firstInboundResult = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("lead_id", params.leadId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const firstContactAt = (firstInboundResult.data?.created_at as string | null) ?? (lead.created_at as string);

  const [contactResult, messageCountResult, firstOutboundResult, latestMessageResult, quoteResult, activityResult, dealResult] =
    await Promise.all([
      lead.contact_id
        ? supabase
            .from("contacts")
            .select("name, phone, email, location, lifecycle")
            .eq("id", lead.contact_id as string)
            .eq("client_id", lead.client_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("client_id", lead.client_id as string)
        .eq("lead_id", params.leadId),
      supabase
        .from("whatsapp_messages")
        .select("created_at")
        .eq("lead_id", params.leadId)
        .eq("direction", "outbound")
        .gte("created_at", firstContactAt)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("whatsapp_messages")
        .select("direction")
        .eq("lead_id", params.leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("quotations")
        .select("currency", { count: "exact" })
        .eq("lead_id", params.leadId)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, actor_name, created_at")
        .eq("lead_id", params.leadId)
        .in("event_type", [
          "LEAD_ASSIGNED",
          "LEAD_REASSIGNED",
          "MESSAGE_SENT",
          "DOCUMENT_SENT",
          "NOTE_ADDED",
          "FOLLOW_UP_SET",
          "FOLLOW_UP_COMPLETED",
          "STATUS_CHANGED",
          "DEAL_CREATED",
          "QUOTE_SENT",
          "CONVERSATION_RESOLVED",
          "CONVERSATION_REOPENED",
        ])
        .order("created_at", { ascending: false })
        .limit(3),
      lead.active_deal_id
        ? supabase
            .from("deals")
            .select(
              "id, name, stage, estimated_value, estimated_value_min, won_value"
            )
            .eq("id", lead.active_deal_id as string)
            .eq("client_id", lead.client_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const firstOutboundAt = firstOutboundResult.data?.created_at as string | null;
  const firstResponseSeconds = firstOutboundAt
    ? Math.max(
        0,
        Math.round((new Date(firstOutboundAt).getTime() - new Date(firstContactAt).getTime()) / 1000)
      )
    : null;
  const contact = contactResult.data as {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    location?: string | null;
    lifecycle?: string | null;
  } | null;
  const deal = dealResult.data as {
    id: string;
    name: string;
    stage: string;
    estimated_value?: number | null;
    estimated_value_min?: number | null;
    won_value?: number | null;
  } | null;
  const latestQuote = quoteResult.data?.[0] as { currency?: string | null } | undefined;
  const conversationStatus =
    (lead.whatsapp_conversation_status as string | null) === "RESOLVED"
      ? "RESOLVED"
      : latestMessageResult.data?.direction === "outbound"
        ? "WAITING_ON_CUSTOMER"
        : "WAITING_ON_TEAM";

  const activity: CompanyConversationActivity[] = (activityResult.data ?? []).map((row) => ({
    id: row.id as string,
    actorName: (row.actor_name as string | null) ?? "SegmiQ",
    label: activityLabel(
      row.event_type as string,
      (row.event_data as Record<string, unknown> | null) ?? {}
    ),
    createdAt: row.created_at as string,
  }));

  const payload: CompanyConversationContext = {
    contact: {
      name: contact?.name ?? (lead.name as string | null) ?? null,
      phone: contact?.phone ?? (lead.phone as string | null) ?? null,
      email: contact?.email ?? (lead.email as string | null) ?? null,
      location: contact?.location ?? null,
      lifecycle: contact?.lifecycle ?? null,
    },
    insights: {
      firstContactAt,
      messageCount: messageCountResult.count ?? 0,
      firstResponseSeconds,
      status: conversationStatus,
    },
    deal: deal
      ? {
          id: deal.id,
          name: deal.name,
          stage: deal.stage,
          value: deal.won_value ?? deal.estimated_value ?? deal.estimated_value_min ?? null,
          currency: latestQuote?.currency ?? "USD",
        }
      : null,
    quoteCount: quoteResult.count ?? 0,
    activity,
  };

  return NextResponse.json({ context: payload });
}
