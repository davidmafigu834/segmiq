/**
 * Explicit system / non-human actor types for Agent, WhatsApp, webhooks, and cron.
 * Never treat "internal" as unrestricted.
 */

export type SegmiqActorType =
  | "HUMAN_USER"
  | "SYSTEM_AGENT"
  | "SYSTEM_AUTOMATION"
  | "SYSTEM_WEBHOOK"
  | "SYSTEM_WHATSAPP"
  | "SYSTEM_CRON"
  | "PLATFORM_ADMIN";

export type TrustedTenantMutation = {
  actorType: SegmiqActorType;
  clientId: string;
  actorUserId?: string | null;
  reason?: string;
};

/** Fail closed if tenant context is missing for a system mutation. */
export function requireTrustedClientId(
  clientId: string | null | undefined,
  context: string
): string {
  const id = clientId?.trim();
  if (!id) {
    throw new Error(`Missing trusted clientId for ${context}`);
  }
  return id;
}

export function isHumanActorType(actorType: SegmiqActorType): boolean {
  return actorType === "HUMAN_USER" || actorType === "PLATFORM_ADMIN";
}
