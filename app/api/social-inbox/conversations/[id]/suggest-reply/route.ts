import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox, loadVisibleConversation } from "@/lib/social-inbox/api-auth";
import { suggestSocialReply } from "@/lib/social-inbox/ai";
import { listMessages, rowToQueueItem } from "@/lib/social-inbox/store";
import type { SocialConversationDetail, SocialIntelligence } from "@/lib/social-inbox/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_REPLY);
  if (!gate.ok) return gate.response;

  const row = await loadVisibleConversation(gate.actor, params.id);
  if (row === "forbidden" || !row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const item = rowToQueueItem(row, gate.actor.userId);
  const messages = await listMessages(gate.actor.clientId, params.id);
  const intelligence: SocialIntelligence = {
    displayName: item.displayName,
    username: item.username,
    avatarUrl: item.avatarUrl,
    channel: item.channel,
    assignedToName: item.assignedToName,
    intentScore: item.intentScore,
    intentBand: item.intentBand,
    reasons: item.intentReasons,
    signals: [],
    detectedProduct: item.detectedProduct,
    detectedLocation: null,
    origin: item.origin,
    crm: {
      state: item.crmState,
      contactId: row.linked_contact_id,
      leadId: row.linked_lead_id,
      dealId: row.linked_deal_id,
      customerName: null,
      openDealName: null,
      match: null,
    },
    nextAction: { label: "Reply", code: "reply", followUpAt: null, followUpReason: null },
    summary: null,
  };
  const detail: SocialConversationDetail = {
    conversation: item,
    messages,
    intelligence,
    replyMode: item.conversationKind === "comment" ? "public_comment" : "private_dm",
    canReply: true,
    canConvert: true,
    canCreateDeal: true,
    canCreateQuote: true,
    canAssign: true,
  };
  const suggested = await suggestSocialReply({ clientId: gate.actor.clientId, detail });
  return NextResponse.json(suggested);
}
