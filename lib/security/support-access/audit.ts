/**
 * Privileged-access audit trail.
 *
 * SECURITY: records identifiers, scopes and outcomes only. Customer content
 * (message bodies, document text, names, phone numbers) and credentials must
 * never reach these rows — see stripCustomerContent.
 */

import { stripCustomerContent } from "./masking";
import type { SupportAccessScope } from "./scopes";

export const SUPPORT_ACCESS_LIFECYCLE_EVENTS = [
  "SUPPORT_ACCESS_REQUESTED",
  "SUPPORT_ACCESS_APPROVED",
  "SUPPORT_ACCESS_DENIED",
  "SUPPORT_ACCESS_STARTED",
  "SUPPORT_ACCESS_EXPIRED",
  "SUPPORT_ACCESS_REVOKED",
  "SUPPORT_ACCESS_DENIED_ATTEMPT",
] as const;

export const CLIENT_DATA_ACCESS_EVENTS = [
  "CLIENT_CONTACT_VIEWED",
  "CLIENT_LEAD_VIEWED",
  "CLIENT_DEAL_VIEWED",
  "CLIENT_CONVERSATION_VIEWED",
  "CLIENT_QUOTATION_VIEWED",
  "CLIENT_DOCUMENT_VIEWED",
  "CLIENT_FILE_DOWNLOADED",
  "CLIENT_AGENT_CONTEXT_VIEWED",
  "CLIENT_DATA_EXPORTED",
  "CLIENT_IMPERSONATION_STARTED",
] as const;

export type SupportAccessEventType =
  | (typeof SUPPORT_ACCESS_LIFECYCLE_EVENTS)[number]
  | (typeof CLIENT_DATA_ACCESS_EVENTS)[number];

/** Default audit event for a scope when the caller does not name one. */
export function scopeAuditEvent(scope: SupportAccessScope): SupportAccessEventType {
  switch (scope) {
    case "CUSTOMER_PROFILES":
      return "CLIENT_CONTACT_VIEWED";
    case "LEADS":
      return "CLIENT_LEAD_VIEWED";
    case "DEALS":
      return "CLIENT_DEAL_VIEWED";
    case "CONVERSATIONS":
      return "CLIENT_CONVERSATION_VIEWED";
    case "QUOTATIONS":
      return "CLIENT_QUOTATION_VIEWED";
    case "DOCUMENTS":
      return "CLIENT_DOCUMENT_VIEWED";
    case "FILES":
      return "CLIENT_FILE_DOWNLOADED";
    case "AGENT_ACTIVITY":
      return "CLIENT_AGENT_CONTEXT_VIEWED";
    default:
      return "CLIENT_CONTACT_VIEWED";
  }
}

export type SupportAccessEventOutcome = "SUCCESS" | "DENIED" | "ERROR";

export type SupportAccessEventInput = {
  eventType: SupportAccessEventType;
  clientId: string;
  grantId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  scope?: SupportAccessScope | null;
  resourceType?: string | null;
  /** Identifier only. Never a name, number, or body. */
  resourceId?: string | null;
  outcome?: SupportAccessEventOutcome;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

/** Never throws — an audit write must not break the caller's error handling. */
export async function recordSupportAccessEvent(
  input: SupportAccessEventInput
): Promise<void> {
  try {
    const [{ createAdminClient }, { sanitizeEventMetadata }] = await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/lib/auth/security-events"),
    ]);
    const supabase = createAdminClient();
    const metadata = sanitizeEventMetadata(
      stripCustomerContent(input.metadata ?? {})
    );
    await supabase.from("support_access_events").insert({
      grant_id: input.grantId ?? null,
      client_id: input.clientId,
      actor_user_id: input.actorUserId ?? null,
      actor_role: input.actorRole ?? null,
      event_type: input.eventType,
      scope: input.scope ?? null,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ? String(input.resourceId).slice(0, 128) : null,
      outcome: input.outcome ?? "SUCCESS",
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ? input.userAgent.slice(0, 512) : null,
      metadata,
    });
  } catch (err) {
    console.warn(
      "[support-access] audit write failed:",
      err instanceof Error ? err.message : "unknown"
    );
  }
}

export type SupportAccessEventRow = {
  id: string;
  grantId: string | null;
  clientId: string;
  actorUserId: string | null;
  actorRole: string | null;
  eventType: string;
  scope: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: SupportAccessEventOutcome;
  createdAt: string;
};

export async function listGrantEvents(
  grantId: string,
  limit = 200
): Promise<SupportAccessEventRow[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_access_events")
    .select(
      "id, grant_id, client_id, actor_user_id, actor_role, event_type, scope, resource_type, resource_id, outcome, created_at"
    )
    .eq("grant_id", grantId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    grantId: (row.grant_id as string | null) ?? null,
    clientId: row.client_id as string,
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorRole: (row.actor_role as string | null) ?? null,
    eventType: row.event_type as string,
    scope: (row.scope as string | null) ?? null,
    resourceType: (row.resource_type as string | null) ?? null,
    resourceId: (row.resource_id as string | null) ?? null,
    outcome: (row.outcome as SupportAccessEventOutcome) ?? "SUCCESS",
    createdAt: row.created_at as string,
  }));
}

/** Human label for the audit timeline. Contains no customer content. */
export function supportAccessEventLabel(row: {
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  scope: string | null;
}): string {
  switch (row.eventType) {
    case "SUPPORT_ACCESS_REQUESTED":
      return "Support access requested";
    case "SUPPORT_ACCESS_APPROVED":
      return "Support access approved";
    case "SUPPORT_ACCESS_DENIED":
      return "Support access denied";
    case "SUPPORT_ACCESS_STARTED":
      return "Support access activated";
    case "SUPPORT_ACCESS_EXPIRED":
      return "Support access expired";
    case "SUPPORT_ACCESS_REVOKED":
      return "Support access ended";
    case "SUPPORT_ACCESS_DENIED_ATTEMPT":
      return `Blocked request${row.scope ? ` — ${row.scope.toLowerCase()}` : ""}`;
    case "CLIENT_IMPERSONATION_STARTED":
      return "Customer impersonation started";
    default:
      break;
  }
  const noun = row.resourceType
    ? row.resourceType.replace(/[_-]+/g, " ")
    : (row.scope ?? "record").toLowerCase();
  const ref = row.resourceId ? ` #${row.resourceId.split("-")[0]}` : "";
  const verb = row.eventType.endsWith("DOWNLOADED")
    ? "downloaded"
    : row.eventType.endsWith("EXPORTED")
      ? "exported"
      : "viewed";
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)}${ref} ${verb}`;
}
