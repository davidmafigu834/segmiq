import { createAdminClient } from "@/lib/supabase/admin";
import { recordSecurityEvent } from "@/lib/auth/security-events";

export type SocialAuditEventType =
  | "channel_connected"
  | "channel_disconnected"
  | "opportunity_assigned"
  | "conversation_reassigned"
  | "lead_converted"
  | "identity_linked"
  | "identity_unlinked"
  | "conversation_resolved"
  | "reply_sent"
  | "ai_reply_sent"
  | "deal_created"
  | "follow_up_created"
  | "bulk_assign"
  | "bulk_resolve";

export async function logSocialAudit(input: {
  clientId: string;
  actorId?: string | null;
  actorName?: string | null;
  eventType: SocialAuditEventType;
  conversationId?: string | null;
  opportunityId?: string | null;
  identityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const metadata = { ...(input.metadata ?? {}) };
    delete metadata.token;
    delete metadata.accessToken;
    delete metadata.access_token;
    await supabase.from("social_audit_events").insert({
      client_id: input.clientId,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      event_type: input.eventType,
      conversation_id: input.conversationId ?? null,
      opportunity_id: input.opportunityId ?? null,
      identity_id: input.identityId ?? null,
      metadata,
    });
    if (input.eventType === "channel_connected") {
      await recordSecurityEvent({
        eventType: "INTEGRATION_CONNECTED",
        userId: input.actorId,
        clientId: input.clientId,
        metadata: { provider: metadata.provider ?? "social" },
      });
    }
    if (input.eventType === "channel_disconnected") {
      await recordSecurityEvent({
        eventType: "INTEGRATION_DISCONNECTED",
        userId: input.actorId,
        clientId: input.clientId,
        metadata: { provider: metadata.provider ?? "social" },
      });
    }
  } catch (err) {
    console.warn("[social-inbox] audit failed", err);
  }
}
