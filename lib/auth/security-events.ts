import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SECURITY: never log passwords, JWTs, cookies, reset tokens, or integration secrets.
 */
export type SecurityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_CREATED"
  | "SESSION_REVOKED"
  | "SESSIONS_REVOKED_OTHERS"
  | "SESSIONS_REVOKED_ALL"
  | "SESSION_EXPIRED"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGED"
  | "USER_DISABLED"
  | "ROLE_CHANGED"
  | "TENANT_CHANGED"
  | "IMPERSONATION_START"
  | "IMPERSONATION_STOP"
  | "IMPERSONATION_STARTED"
  | "IMPERSONATION_STOPPED"
  | "LOGOUT_ALL"
  | "MFA_SETUP_STARTED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "MFA_CHALLENGE_FAILED"
  | "MFA_CHALLENGE_SUCCESS"
  | "RECOVERY_CODE_USED"
  | "RECOVERY_CODES_REGENERATED"
  | "STEP_UP_SUCCESS"
  | "EMAIL_CHANGED"
  | "MFA_ADMIN_RESET"
  | "WHATSAPP_CONNECTION_CREATED"
  | "WHATSAPP_QR_GENERATED"
  | "WHATSAPP_CONNECTED"
  | "WHATSAPP_DISCONNECTED"
  | "WHATSAPP_RECONNECTED"
  | "WHATSAPP_SESSION_EXPIRED"
  | "WHATSAPP_CONNECTION_REMOVED"
  | "AGENT_ACTION_BLOCKED"
  | "AGENT_CONFIRMATION_REQUIRED"
  | "AGENT_CONFIRMATION_APPROVED"
  | "AGENT_CONFIRMATION_REJECTED"
  | "INTEGRATION_CONNECTED"
  | "INTEGRATION_DISCONNECTED"
  | "INTEGRATION_AUTH_FAILED"
  | "ORG_SECURITY_POLICY_UPDATED"
  | "WEBSITE_API_KEY_ROTATED"
  | "WEBSITE_API_KEY_REVOKED"
  | "CRM_RESET_INITIATED"
  | "CRM_RESET_COMPLETED"
  | "CRM_RESET_FAILED"
  | "DATA_EXPORT"
  | "SECURITY_AUDIT_EXPORT";

export async function recordSecurityEvent(input: {
  eventType: SecurityEventType;
  userId?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const meta = sanitizeEventMetadata(input.metadata ?? {});
    await supabase.from("security_events").insert({
      user_id: input.userId ?? null,
      client_id: input.clientId ?? null,
      session_id: input.sessionId ?? null,
      event_type: input.eventType,
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ? input.userAgent.slice(0, 512) : null,
      metadata: meta,
    });
  } catch (err) {
    console.warn(
      "[security-events] write failed:",
      err instanceof Error ? err.message : "unknown"
    );
  }
}

const FORBIDDEN_META_KEYS = new Set([
  "password",
  "token",
  "jwt",
  "cookie",
  "authorization",
  "accessToken",
  "refreshToken",
  "secret",
]);

export function sanitizeEventMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEYS.has(k) || /password|token|secret|cookie|jwt|otp|totp|recovery/i.test(k)) continue;
    if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 500);
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Stable non-reversible identifier for failed-login logs (no plaintext email in clear form required). */
export async function hashLoginIdentifier(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const data = new TextEncoder().encode(`segmiq-login:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
