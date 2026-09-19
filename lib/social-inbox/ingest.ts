import { createAdminClient } from "@/lib/supabase/admin";
import { classifySocialIntent } from "./intent";
import { bandFromScore } from "./scoring";
import type { SocialChannel, SocialConversationKind, SocialProvider } from "./types";

export async function upsertSocialIdentity(opts: {
  clientId: string;
  provider: SocialProvider;
  providerUserId: string;
  displayName?: string | null;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("social_identities")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("provider", opts.provider)
    .eq("provider_user_id", opts.providerUserId)
    .maybeSingle();
  if (existing?.id) {
    if (opts.displayName) {
      await supabase
        .from("social_identities")
        .update({ display_name: opts.displayName, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .is("display_name", null);
    }
    return existing.id as string;
  }
  const { data: created } = await supabase
    .from("social_identities")
    .insert({
      client_id: opts.clientId,
      provider: opts.provider,
      provider_user_id: opts.providerUserId,
      display_name: opts.displayName ?? null,
    })
    .select("id")
    .single();
  return created?.id as string;
}

export async function upsertSocialConversation(opts: {
  clientId: string;
  connectionId: string | null;
  identityId: string;
  provider: SocialProvider;
  channel: SocialChannel;
  kind: SocialConversationKind;
  visibility: "public" | "private";
  threadId: string;
  preview: string;
  inboundAt: string;
  unread?: boolean;
  origin?: {
    kind?: string;
    campaignName?: string | null;
    adName?: string | null;
    postId?: string | null;
    permalink?: string | null;
    caption?: string | null;
    customerQuote?: string | null;
  };
}): Promise<{ conversationId: string; assignedToId: string | null; classification: ReturnType<typeof classifySocialIntent> }> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("social_conversations")
    .select("id, assigned_to_id, last_message_at")
    .eq("client_id", opts.clientId)
    .eq("provider", opts.provider)
    .eq("provider_thread_id", opts.threadId)
    .maybeSingle();

  const classification = classifySocialIntent({
    text: opts.preview,
    conversationKind: opts.kind,
  });

  if (existing?.id) {
    const previous = existing.last_message_at ? Date.parse(existing.last_message_at as string) : 0;
    const next = Date.parse(opts.inboundAt);
    if (!Number.isFinite(previous) || next >= previous) {
      await supabase
        .from("social_conversations")
        .update({
          unread: opts.unread ?? true,
          status: "needs_reply",
          last_message_at: opts.inboundAt,
          last_customer_message_at: opts.inboundAt,
          last_message_preview: opts.preview.slice(0, 180),
          updated_at: opts.inboundAt,
        })
        .eq("id", existing.id)
        .eq("client_id", opts.clientId);
    }
    return {
      conversationId: existing.id as string,
      assignedToId: existing.assigned_to_id as string | null,
      classification,
    };
  }

  const { data: created } = await supabase
    .from("social_conversations")
    .insert({
      client_id: opts.clientId,
      connection_id: opts.connectionId,
      identity_id: opts.identityId,
      provider: opts.provider,
      channel: opts.channel,
      conversation_kind: opts.kind,
      visibility: opts.visibility,
      status: "needs_reply",
      provider_thread_id: opts.threadId,
      unread: opts.unread ?? true,
      last_message_at: opts.inboundAt,
      last_customer_message_at: opts.inboundAt,
      last_message_preview: opts.preview.slice(0, 180),
      origin_kind: opts.origin?.kind ?? (opts.channel.includes("ad") ? "advertisement" : "organic"),
      origin_campaign_name: opts.origin?.campaignName ?? null,
      origin_ad_name: opts.origin?.adName ?? null,
      origin_post_id: opts.origin?.postId ?? null,
      origin_permalink: opts.origin?.permalink ?? null,
      origin_caption: opts.origin?.caption ?? null,
      origin_customer_quote: opts.origin?.customerQuote ?? opts.preview.slice(0, 240),
    })
    .select("id, assigned_to_id")
    .single();

  const conversationId = created?.id as string;
  if (classification.isOpportunity && conversationId) {
    await supabase.from("social_opportunities").insert({
      client_id: opts.clientId,
      conversation_id: conversationId,
      identity_id: opts.identityId,
      status: "new",
      intent_score: classification.score,
      intent_band: bandFromScore(classification.score),
      intent_reasons: classification.reasons,
      detected_product: classification.detectedProduct,
      detected_location: classification.detectedLocation,
      recommended_action: classification.recommendedAction,
      recommended_action_code: classification.recommendedActionCode,
      last_interaction_at: opts.inboundAt,
    });
  }
  return { conversationId, assignedToId: created?.assigned_to_id as string | null, classification };
}

export async function insertSocialMessage(opts: {
  clientId: string;
  conversationId: string;
  identityId: string | null;
  providerMessageId: string;
  body: string;
  visibility: "public" | "private";
  sentAt: string;
  direction: "inbound" | "outbound";
}): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("social_messages").insert({
    client_id: opts.clientId,
    conversation_id: opts.conversationId,
    identity_id: opts.identityId,
    provider_message_id: opts.providerMessageId,
    direction: opts.direction,
    visibility: opts.visibility,
    body: opts.body,
    send_status: "sent",
    sent_at: opts.sentAt,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return false;
    throw error;
  }
  return true;
}
