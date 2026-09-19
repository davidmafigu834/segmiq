import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { notifySocialInbox } from "./notifications";
import { insertSocialMessage, upsertSocialConversation, upsertSocialIdentity } from "./ingest";
import type { SocialChannel, SocialProvider } from "./types";

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

type FeedChange = {
  item?: string;
  comment_id?: string;
  post_id?: string;
  verb?: string;
  message?: string;
  from?: { id?: string; name?: string };
  post?: { permalink_url?: string; id?: string };
};

export type SocialWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: MessagingEvent[];
    changes?: Array<{ field?: string; value?: FeedChange & Record<string, unknown> }>;
  }>;
};

function hashPayload(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function claimEvent(provider: string, providerEventId: string, payloadHash: string, clientId: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("social_webhook_events").insert({
    provider,
    provider_event_id: providerEventId,
    payload_hash: payloadHash,
    client_id: clientId,
    status: "received",
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return false;
    console.warn("[social-inbox] webhook claim", error.message);
    return false;
  }
  return true;
}

async function markEvent(provider: string, providerEventId: string, status: "processed" | "ignored" | "failed", error?: string) {
  const supabase = createAdminClient();
  await supabase
    .from("social_webhook_events")
    .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);
}

async function findClientByExternalAccount(provider: SocialProvider, externalId: string): Promise<{
  id: string;
  connectionId: string | null;
} | null> {
  const supabase = createAdminClient();
  const { data: conn } = await supabase
    .from("social_channel_connections")
    .select("id, client_id")
    .eq("provider", provider)
    .eq("external_account_id", externalId)
    .neq("status", "disconnected")
    .maybeSingle();
  if (conn?.client_id) {
    return { id: conn.client_id as string, connectionId: conn.id as string };
  }
  if (provider === "facebook") {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("fb_page_id", externalId)
      .eq("is_active", true)
      .maybeSingle();
    if (client?.id) return { id: client.id as string, connectionId: null };
  }
  return null;
}

async function processMessaging(opts: {
  provider: SocialProvider;
  pageId: string;
  event: MessagingEvent;
  payloadHash: string;
}) {
  const mid = opts.event.message?.mid;
  if (!mid || opts.event.message?.is_echo) return;
  const claimed = await claimEvent(opts.provider, mid, opts.payloadHash, null);
  if (!claimed) return;
  try {
    const client = await findClientByExternalAccount(opts.provider, opts.pageId);
    if (!client) {
      await markEvent(opts.provider, mid, "ignored", "no_client");
      return;
    }
    const senderId = opts.event.sender?.id;
    if (!senderId) {
      await markEvent(opts.provider, mid, "ignored", "no_sender");
      return;
    }
    const text = opts.event.message?.text?.trim() || "";
    const sentAt = opts.event.timestamp ? new Date(opts.event.timestamp).toISOString() : new Date().toISOString();
    const channel: SocialChannel = opts.provider === "instagram" ? "instagram_dm" : "facebook_messenger";
    const identityId = await upsertSocialIdentity({
      clientId: client.id,
      provider: opts.provider,
      providerUserId: senderId,
    });
    const convo = await upsertSocialConversation({
      clientId: client.id,
      connectionId: client.connectionId,
      identityId,
      provider: opts.provider,
      channel,
      kind: "dm",
      visibility: "private",
      threadId: senderId,
      preview: text,
      inboundAt: sentAt,
    });
    await insertSocialMessage({
      clientId: client.id,
      conversationId: convo.conversationId,
      identityId,
      providerMessageId: mid,
      body: text,
      visibility: "private",
      sentAt,
      direction: "inbound",
    });
    if (convo.assignedToId && convo.classification.band === "hot") {
      await notifySocialInbox({
        userId: convo.assignedToId,
        clientId: client.id,
        conversationId: convo.conversationId,
        message: `High-intent ${opts.provider} message waiting for you`,
      });
    }
    await markEvent(opts.provider, mid, "processed");
  } catch (err) {
    await markEvent(opts.provider, mid, "failed", err instanceof Error ? err.message : "error");
  }
}

async function processComment(opts: {
  provider: SocialProvider;
  pageId: string;
  value: FeedChange;
  payloadHash: string;
  isAd?: boolean;
}) {
  if (opts.value.item && opts.value.item !== "comment") return;
  const commentId = opts.value.comment_id;
  if (!commentId || opts.value.verb === "remove") return;
  const claimed = await claimEvent(opts.provider, commentId, opts.payloadHash, null);
  if (!claimed) return;
  try {
    const client = await findClientByExternalAccount(opts.provider, opts.pageId);
    if (!client) {
      await markEvent(opts.provider, commentId, "ignored", "no_client");
      return;
    }
    const fromId = opts.value.from?.id;
    if (!fromId) {
      await markEvent(opts.provider, commentId, "ignored", "no_from");
      return;
    }
    const text = opts.value.message?.trim() || "";
    const sentAt = new Date().toISOString();
    const channel: SocialChannel =
      opts.provider === "instagram"
        ? opts.isAd
          ? "instagram_ad_comment"
          : "instagram_comment"
        : opts.isAd
          ? "facebook_ad_comment"
          : "facebook_comment";
    const identityId = await upsertSocialIdentity({
      clientId: client.id,
      provider: opts.provider,
      providerUserId: fromId,
      displayName: opts.value.from?.name ?? null,
    });
    const convo = await upsertSocialConversation({
      clientId: client.id,
      connectionId: client.connectionId,
      identityId,
      provider: opts.provider,
      channel,
      kind: "comment",
      visibility: "public",
      threadId: commentId,
      preview: text,
      inboundAt: sentAt,
      origin: {
        kind: opts.isAd ? "advertisement" : "post",
        postId: opts.value.post_id ?? opts.value.post?.id ?? null,
        permalink: opts.value.post?.permalink_url ?? null,
        customerQuote: text,
      },
    });
    await insertSocialMessage({
      clientId: client.id,
      conversationId: convo.conversationId,
      identityId,
      providerMessageId: commentId,
      body: text,
      visibility: "public",
      sentAt,
      direction: "inbound",
    });
    if (convo.assignedToId && convo.classification.band === "hot") {
      await notifySocialInbox({
        userId: convo.assignedToId,
        clientId: client.id,
        conversationId: convo.conversationId,
        message: `High-intent ${opts.provider} comment waiting for you`,
      });
    }
    await markEvent(opts.provider, commentId, "processed");
  } catch (err) {
    await markEvent(opts.provider, commentId, "failed", err instanceof Error ? err.message : "error");
  }
}

/**
 * Acknowledge the provider immediately; process via background().
 * Safe to call from the existing Facebook webhook without blocking leadgen/WhatsApp.
 */
export function ingestSocialWebhook(payload: SocialWebhookPayload, rawBody: string): void {
  const payloadHash = hashPayload(rawBody);
  background("social-inbox.webhook", async () => {
    const objectType = payload.object;
    if (objectType !== "page" && objectType !== "instagram") return;
    const provider: SocialProvider = objectType === "instagram" ? "instagram" : "facebook";
    for (const entry of payload.entry ?? []) {
      const pageId = entry.id ?? "";
      for (const event of entry.messaging ?? []) {
        if (event.message?.text) {
          await processMessaging({ provider, pageId, event, payloadHash });
        }
      }
      for (const change of entry.changes ?? []) {
        if (change.field === "feed" || change.field === "comments") {
          const adId = (change.value as { ad_id?: string } | undefined)?.ad_id;
          await processComment({
            provider,
            pageId,
            value: change.value ?? {},
            payloadHash,
            isAd: Boolean(adId),
          });
        }
      }
    }
  });
}
