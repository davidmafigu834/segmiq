import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox, loadVisibleConversation } from "@/lib/social-inbox/api-auth";
import { listMessages, rowToQueueItem } from "@/lib/social-inbox/store";
import { summarizeSocialConversation } from "@/lib/social-inbox/ai";
import { canAssignSocialInbox, canConvertSocialLead, canCreateSocialDeal, canCreateSocialQuote, canReplySocialInbox } from "@/lib/social-inbox/access";
import type { SocialConversationDetail, SocialIntelligence } from "@/lib/social-inbox/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  return value as Record<string, unknown>;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_VIEW);
  if (!gate.ok) return gate.response;

  const row = await loadVisibleConversation(gate.actor, params.id);
  if (row === "forbidden") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!row) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const item = rowToQueueItem(row, gate.actor.userId);
  const messages = await listMessages(gate.actor.clientId, params.id);
  const identity = asRecord(row.identity);
  const opp = asRecord(row.opportunity);
  const assignee = asRecord(row.assignee);

  let match: SocialIntelligence["crm"]["match"] = null;
  if (row.linked_contact_id || row.linked_lead_id) {
    const supabase = createAdminClient();
    let customerName: string | null = null;
    let openDealName: string | null = null;
    let previousEnquiryCount = 0;
    if (row.linked_contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, primary_contact_name")
        .eq("id", row.linked_contact_id)
        .eq("client_id", gate.actor.clientId)
        .maybeSingle();
      customerName = (contact?.primary_contact_name as string | null) || (contact?.name as string | null);
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", gate.actor.clientId)
        .eq("contact_id", row.linked_contact_id);
      previousEnquiryCount = count ?? 0;
    }
    if (row.linked_deal_id) {
      const supabaseDeal = createAdminClient();
      const { data: deal } = await supabaseDeal
        .from("deals")
        .select("name, stage")
        .eq("id", row.linked_deal_id)
        .eq("client_id", gate.actor.clientId)
        .maybeSingle();
      openDealName = deal ? `${deal.name} (${String(deal.stage).replace(/_/g, " ").toLowerCase()})` : null;
    }
    match = {
      contactId: row.linked_contact_id,
      leadId: row.linked_lead_id,
      dealId: row.linked_deal_id,
      name: customerName || item.displayName,
      reason: row.linked_deal_id ? "Existing customer with an open deal" : "Existing CRM record",
      confidence: "high",
      openDealName,
      previousEnquiryCount,
    };
  }

  const intelligence: SocialIntelligence = {
    displayName: item.displayName,
    username: item.username,
    avatarUrl: item.avatarUrl,
    channel: item.channel,
    assignedToName: (assignee?.name as string | undefined) ?? item.assignedToName,
    intentScore: item.intentScore,
    intentBand: item.intentBand,
    reasons: item.intentReasons,
    signals: [],
    detectedProduct: item.detectedProduct,
    detectedLocation: (opp?.detected_location as string | null) ?? null,
    origin: item.origin,
    crm: {
      state: item.crmState,
      contactId: row.linked_contact_id,
      leadId: row.linked_lead_id,
      dealId: row.linked_deal_id,
      customerName: match?.name ?? null,
      openDealName: match?.openDealName ?? null,
      match,
    },
    nextAction: {
      label: (opp?.recommended_action as string | null) || (item.unread ? "Reply" : "Review"),
      code: (opp?.recommended_action_code as string | null) ?? null,
      followUpAt: (opp?.follow_up_at as string | null) ?? null,
      followUpReason: (opp?.follow_up_reason as string | null) ?? null,
    },
    summary: null,
  };

  const detail: SocialConversationDetail = {
    conversation: item,
    messages,
    intelligence,
    replyMode: item.conversationKind === "comment" ? "public_comment" : "private_dm",
    canReply: canReplySocialInbox(gate.actor) && (item.assignedToId === gate.actor.userId || canAssignSocialInbox(gate.actor)),
    canConvert: canConvertSocialLead(gate.actor),
    canCreateDeal: canCreateSocialDeal(gate.actor),
    canCreateQuote: canCreateSocialQuote(gate.actor) && Boolean(row.linked_lead_id),
    canAssign: canAssignSocialInbox(gate.actor),
  };
  detail.intelligence.summary = await summarizeSocialConversation(detail);
  void identity;
  return NextResponse.json(detail);
}
