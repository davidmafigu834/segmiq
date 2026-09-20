/**
 * Server-side Support Access grant store.
 *
 * The grant row is the only authority on privileged access. Nothing here reads
 * request state to decide authorisation — callers pass the authenticated admin
 * id resolved from the session registry.
 */

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { recordSupportAccessEvent } from "./audit";
import {
  effectiveGrantStatus,
  resolveApprovalMode,
  type SupportAccessApprovalMode,
  type SupportAccessGrant,
  type SupportAccessKind,
  type SupportAccessStatus,
} from "./policy";
import { parseSupportAccessScopes, type SupportAccessScope } from "./scopes";

const GRANT_COLUMNS =
  "id, reference, admin_user_id, client_id, status, access_kind, approval_mode, scopes, reason, ticket_reference, duration_minutes, requested_at, approved_at, approved_by_user_id, started_at, expires_at, revoked_at, revoked_reason, denied_at, denial_reason";

type GrantRow = Record<string, unknown>;

function mapGrant(row: GrantRow): SupportAccessGrant {
  return {
    id: row.id as string,
    reference: row.reference as string,
    adminUserId: row.admin_user_id as string,
    clientId: row.client_id as string,
    status: row.status as SupportAccessStatus,
    accessKind: (row.access_kind as SupportAccessKind) ?? "SUPPORT",
    approvalMode: (row.approval_mode as SupportAccessApprovalMode) ?? "SELF_APPROVAL",
    scopes: parseSupportAccessScopes(row.scopes),
    reason: (row.reason as string) ?? "",
    ticketReference: (row.ticket_reference as string | null) ?? null,
    durationMinutes: Number(row.duration_minutes ?? 0),
    requestedAt: row.requested_at as string,
    approvedAt: (row.approved_at as string | null) ?? null,
    approvedByUserId: (row.approved_by_user_id as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    revokedReason: (row.revoked_reason as string | null) ?? null,
    deniedAt: (row.denied_at as string | null) ?? null,
    denialReason: (row.denial_reason as string | null) ?? null,
  };
}

function newReference(): string {
  return `SA-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Flip a stored ACTIVE row to EXPIRED once its expiry has passed, so the audit
 * trail and the UI agree with the authorisation decision.
 */
async function settleExpiry(grant: SupportAccessGrant): Promise<SupportAccessGrant> {
  if (grant.status !== "ACTIVE") return grant;
  if (effectiveGrantStatus(grant) === "ACTIVE") return grant;

  const supabase = createAdminClient();
  await supabase
    .from("support_access_grants")
    .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
    .eq("id", grant.id)
    .eq("status", "ACTIVE");

  void recordSupportAccessEvent({
    eventType: "SUPPORT_ACCESS_EXPIRED",
    clientId: grant.clientId,
    grantId: grant.id,
    actorUserId: grant.adminUserId,
    actorRole: "SUPER_ADMIN",
    metadata: { reference: grant.reference },
  });

  return { ...grant, status: "EXPIRED" };
}

/**
 * The administrator's live grant for one organisation, if any.
 * Returns EXPIRED/REVOKED rows too so callers can produce a precise error.
 */
export async function findLatestGrant(
  adminUserId: string,
  clientId: string
): Promise<SupportAccessGrant | null> {
  if (!adminUserId || !clientId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_access_grants")
    .select(GRANT_COLUMNS)
    .eq("admin_user_id", adminUserId)
    .eq("client_id", clientId)
    .order("requested_at", { ascending: false })
    .limit(1);

  const row = (data ?? [])[0];
  if (!row) return null;
  return settleExpiry(mapGrant(row as GrantRow));
}

export async function findGrantById(
  grantId: string
): Promise<SupportAccessGrant | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_access_grants")
    .select(GRANT_COLUMNS)
    .eq("id", grantId)
    .maybeSingle();
  if (!data) return null;
  return settleExpiry(mapGrant(data as GrantRow));
}

/** Every grant the administrator currently holds (for the privileged-mode banner). */
export async function listActiveGrantsForAdmin(
  adminUserId: string
): Promise<SupportAccessGrant[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_access_grants")
    .select(GRANT_COLUMNS)
    .eq("admin_user_id", adminUserId)
    .in("status", ["PENDING", "APPROVED", "ACTIVE"])
    .order("requested_at", { ascending: false })
    .limit(20);

  const grants = await Promise.all(
    (data ?? []).map((row) => settleExpiry(mapGrant(row as GrantRow)))
  );
  return grants.filter((g) => effectiveGrantStatus(g) !== "EXPIRED" || g.status !== "EXPIRED");
}

export type SupportAccessGrantListRow = SupportAccessGrant & {
  adminName: string | null;
  clientName: string | null;
};

export async function listGrants(opts: {
  clientId?: string | null;
  adminUserId?: string | null;
  limit?: number;
}): Promise<SupportAccessGrantListRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("support_access_grants")
    .select(`${GRANT_COLUMNS}, users!support_access_grants_admin_user_id_fkey(name), clients(name)`)
    .order("requested_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (opts.adminUserId) query = query.eq("admin_user_id", opts.adminUserId);

  const { data, error } = await query;
  if (error) {
    // Fall back to the plain projection if the FK alias is unavailable.
    let plain = supabase
      .from("support_access_grants")
      .select(GRANT_COLUMNS)
      .order("requested_at", { ascending: false })
      .limit(opts.limit ?? 100);
    if (opts.clientId) plain = plain.eq("client_id", opts.clientId);
    if (opts.adminUserId) plain = plain.eq("admin_user_id", opts.adminUserId);
    const { data: rows } = await plain;
    return (rows ?? []).map((row) => ({
      ...mapGrant(row as GrantRow),
      adminName: null,
      clientName: null,
    }));
  }

  return (data ?? []).map((row) => {
    const r = row as GrantRow & {
      users?: { name?: string } | null;
      clients?: { name?: string } | null;
    };
    return {
      ...mapGrant(r),
      adminName: r.users?.name ?? null,
      clientName: r.clients?.name ?? null,
    };
  });
}

export type CreateGrantInput = {
  adminUserId: string;
  adminRole: string;
  clientId: string;
  reason: string;
  ticketReference: string | null;
  scopes: SupportAccessScope[];
  durationMinutes: number;
  accessKind: SupportAccessKind;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Create a request and, under SELF_APPROVAL policy, activate it immediately.
 * Under any other policy the grant stays PENDING until a second authority acts.
 */
export async function createGrant(
  input: CreateGrantInput
): Promise<
  { ok: true; grant: SupportAccessGrant } | { ok: false; error: string; status: 409 | 500 }
> {
  const supabase = createAdminClient();
  const existing = await findLatestGrant(input.adminUserId, input.clientId);
  if (existing && ["PENDING", "APPROVED", "ACTIVE"].includes(effectiveGrantStatus(existing))) {
    return {
      ok: false,
      status: 409,
      error: "You already have a Support Access request open for this organisation",
    };
  }

  const approvalMode = resolveApprovalMode();
  const selfApproved = approvalMode === "SELF_APPROVAL";
  const now = new Date();
  const expiresAt = selfApproved
    ? new Date(now.getTime() + input.durationMinutes * 60_000)
    : null;

  const { data, error } = await supabase
    .from("support_access_grants")
    .insert({
      reference: newReference(),
      admin_user_id: input.adminUserId,
      client_id: input.clientId,
      status: selfApproved ? "ACTIVE" : "PENDING",
      access_kind: input.accessKind,
      approval_mode: approvalMode,
      scopes: input.scopes,
      reason: input.reason,
      ticket_reference: input.ticketReference,
      duration_minutes: input.durationMinutes,
      requested_at: now.toISOString(),
      approved_at: selfApproved ? now.toISOString() : null,
      approved_by_user_id: selfApproved ? input.adminUserId : null,
      approved_by_kind: selfApproved ? "SELF" : null,
      started_at: selfApproved ? now.toISOString() : null,
      expires_at: expiresAt?.toISOString() ?? null,
      request_ip: input.ip ?? null,
      request_user_agent: input.userAgent?.slice(0, 512) ?? null,
      session_id: input.sessionId ?? null,
    })
    .select(GRANT_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    console.warn("[support-access] grant insert failed:", error?.message ?? "no row");
    return { ok: false, status: 500, error: "Could not create the Support Access request" };
  }

  const grant = mapGrant(data as GrantRow);
  const base = {
    clientId: grant.clientId,
    grantId: grant.id,
    actorUserId: input.adminUserId,
    actorRole: input.adminRole,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  };

  await recordSupportAccessEvent({
    ...base,
    eventType: "SUPPORT_ACCESS_REQUESTED",
    metadata: {
      reference: grant.reference,
      scopes: grant.scopes,
      durationMinutes: grant.durationMinutes,
      approvalMode,
      accessKind: grant.accessKind,
      ticketReference: grant.ticketReference,
    },
  });

  if (selfApproved) {
    await recordSupportAccessEvent({
      ...base,
      eventType: "SUPPORT_ACCESS_APPROVED",
      metadata: { reference: grant.reference, approvedBy: "SELF", approvalMode },
    });
    await recordSupportAccessEvent({
      ...base,
      eventType: "SUPPORT_ACCESS_STARTED",
      metadata: { reference: grant.reference, expiresAt: grant.expiresAt },
    });
  }

  void recordSecurityEvent({
    eventType: "SUPPORT_ACCESS_REQUESTED",
    userId: input.adminUserId,
    clientId: grant.clientId,
    sessionId: input.sessionId ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: {
      reference: grant.reference,
      scopes: grant.scopes,
      accessKind: grant.accessKind,
      approvalMode,
      status: grant.status,
    },
  });

  return { ok: true, grant };
}

/** Approve a PENDING grant and start the clock. */
export async function approveGrant(input: {
  grantId: string;
  approverUserId: string;
  approverKind: "PLATFORM_ADMIN" | "CLIENT_ADMIN";
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: true; grant: SupportAccessGrant } | { ok: false; error: string; status: 403 | 404 | 409 }> {
  const grant = await findGrantById(input.grantId);
  if (!grant) return { ok: false, status: 404, error: "Request not found" };
  if (effectiveGrantStatus(grant) !== "PENDING") {
    return { ok: false, status: 409, error: "This request is no longer pending" };
  }
  if (
    grant.approvalMode === "SECOND_ADMIN_REQUIRED" &&
    grant.adminUserId === input.approverUserId
  ) {
    return { ok: false, status: 403, error: "A second administrator must approve this request" };
  }

  const supabase = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + grant.durationMinutes * 60_000);
  const { data } = await supabase
    .from("support_access_grants")
    .update({
      status: "ACTIVE",
      approved_at: now.toISOString(),
      approved_by_user_id: input.approverUserId,
      approved_by_kind: input.approverKind,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", grant.id)
    .eq("status", "PENDING")
    .select(GRANT_COLUMNS)
    .maybeSingle();

  if (!data) return { ok: false, status: 409, error: "This request is no longer pending" };
  const updated = mapGrant(data as GrantRow);

  await recordSupportAccessEvent({
    eventType: "SUPPORT_ACCESS_APPROVED",
    clientId: updated.clientId,
    grantId: updated.id,
    actorUserId: input.approverUserId,
    actorRole: input.approverKind,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: { reference: updated.reference, approvalMode: updated.approvalMode },
  });
  await recordSupportAccessEvent({
    eventType: "SUPPORT_ACCESS_STARTED",
    clientId: updated.clientId,
    grantId: updated.id,
    actorUserId: updated.adminUserId,
    actorRole: "SUPER_ADMIN",
    metadata: { reference: updated.reference, expiresAt: updated.expiresAt },
  });

  return { ok: true, grant: updated };
}

export async function denyGrant(input: {
  grantId: string;
  deciderUserId: string;
  reason?: string | null;
}): Promise<{ ok: true; grant: SupportAccessGrant } | { ok: false; error: string; status: 404 | 409 }> {
  const grant = await findGrantById(input.grantId);
  if (!grant) return { ok: false, status: 404, error: "Request not found" };
  if (effectiveGrantStatus(grant) !== "PENDING") {
    return { ok: false, status: 409, error: "This request is no longer pending" };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("support_access_grants")
    .update({
      status: "DENIED",
      denied_at: now,
      denied_by_user_id: input.deciderUserId,
      denial_reason: input.reason?.slice(0, 500) ?? null,
      updated_at: now,
    })
    .eq("id", grant.id)
    .eq("status", "PENDING")
    .select(GRANT_COLUMNS)
    .maybeSingle();

  if (!data) return { ok: false, status: 409, error: "This request is no longer pending" };
  const updated = mapGrant(data as GrantRow);

  await recordSupportAccessEvent({
    eventType: "SUPPORT_ACCESS_DENIED",
    clientId: updated.clientId,
    grantId: updated.id,
    actorUserId: input.deciderUserId,
    actorRole: "PLATFORM_ADMIN",
    metadata: { reference: updated.reference },
  });

  return { ok: true, grant: updated };
}

/** End access immediately. Idempotent for already-closed grants. */
export async function revokeGrant(input: {
  grantId: string;
  actorUserId: string;
  actorRole: string;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: true; grant: SupportAccessGrant } | { ok: false; error: string; status: 404 }> {
  const grant = await findGrantById(input.grantId);
  if (!grant) return { ok: false, status: 404, error: "Request not found" };

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from("support_access_grants")
    .update({
      status: "REVOKED",
      revoked_at: now,
      revoked_by_user_id: input.actorUserId,
      revoked_reason: input.reason?.slice(0, 500) ?? null,
      updated_at: now,
    })
    .eq("id", grant.id)
    .in("status", ["PENDING", "APPROVED", "ACTIVE"]);

  await recordSupportAccessEvent({
    eventType: "SUPPORT_ACCESS_REVOKED",
    clientId: grant.clientId,
    grantId: grant.id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: { reference: grant.reference },
  });

  void recordSecurityEvent({
    eventType: "SUPPORT_ACCESS_REVOKED",
    userId: input.actorUserId,
    clientId: grant.clientId,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: { reference: grant.reference },
  });

  return {
    ok: true,
    grant: { ...grant, status: "REVOKED", revokedAt: now },
  };
}
