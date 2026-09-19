import { graphCall } from "@/lib/facebook/graph";
import { revealFbPageToken } from "@/lib/facebook/client-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialChannel, SocialProvider } from "./types";

export type SocialSendRequest = {
  clientId: string;
  connectionId: string | null;
  channel: SocialChannel;
  providerThreadId: string | null;
  recipientId: string;
  body: string;
  visibility: "public" | "private";
};

export type SocialSendResult =
  | { ok: true; providerMessageId: string | null; mode: "public_comment" | "private_dm" }
  | { ok: false; error: string; code: string };

async function pageTokenFor(clientId: string, connectionId: string | null): Promise<string | null> {
  const supabase = createAdminClient();
  if (connectionId) {
    const { data } = await supabase
      .from("social_channel_connections")
      .select("token_sealed, is_demo")
      .eq("id", connectionId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (data?.is_demo) return null;
    if (data?.token_sealed) {
      return revealFbPageToken(data.token_sealed as string, clientId);
    }
  }
  const { data: client } = await supabase
    .from("clients")
    .select("fb_access_token")
    .eq("id", clientId)
    .maybeSingle();
  return revealFbPageToken((client?.fb_access_token as string | null) ?? null, clientId);
}

export function replyModeFor(channel: SocialChannel, visibility: "public" | "private"): "public_comment" | "private_dm" {
  if (visibility === "public" || channel.includes("comment")) return "public_comment";
  return "private_dm";
}

/**
 * Official Meta Graph send. Never scrapes. Fails closed when credentials are missing.
 */
export async function sendSocialMessage(req: SocialSendRequest): Promise<SocialSendResult> {
  const mode = replyModeFor(req.channel, req.visibility);
  const token = await pageTokenFor(req.clientId, req.connectionId);
  if (!token) {
    return {
      ok: false,
      error: "Social channel is not connected with a valid Meta token.",
      code: "not_connected",
    };
  }

  if (mode === "public_comment") {
    const commentId = req.providerThreadId;
    if (!commentId) {
      return { ok: false, error: "Missing comment id for a public reply.", code: "missing_thread" };
    }
    const res = await graphCall<{ id?: string }>(`/${commentId}/comments`, token, {
      method: "POST",
      body: { message: req.body },
      clientId: req.clientId,
    });
    if (!res.ok) {
      return { ok: false, error: "Could not post the public reply.", code: "provider_error" };
    }
    return { ok: true, providerMessageId: res.data.id ?? null, mode };
  }

  const recipient = req.recipientId;
  if (!recipient) {
    return { ok: false, error: "Missing recipient for a private message.", code: "missing_recipient" };
  }
  const path = req.channel.startsWith("instagram") ? "/me/messages" : "/me/messages";
  const res = await graphCall<{ message_id?: string }>(path, token, {
    method: "POST",
    body: {
      recipient: { id: recipient },
      message: { text: req.body },
      messaging_type: "RESPONSE",
    },
    clientId: req.clientId,
  });
  if (!res.ok) {
    return { ok: false, error: "Could not send the private message.", code: "provider_error" };
  }
  return { ok: true, providerMessageId: res.data.message_id ?? null, mode };
}

export function providerFromChannel(channel: SocialChannel): SocialProvider {
  return channel.startsWith("instagram") ? "instagram" : "facebook";
}
