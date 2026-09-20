/**
 * Central server-side enforcement for privileged client-data access.
 *
 * Every sensitive operation resolves authorisation here. There is no second
 * implementation: routes call requirePrivilegedTenantAccess (or the
 * requireClientDataAccess convenience wrapper) and act on the result.
 *
 * SECURITY INVARIANTS
 * 1. Authorisation is derived from the authenticated session plus the grant row.
 *    Never from cookies set by client JS, query strings, or React state.
 * 2. A grant authorises exactly one organisation and exactly the scopes listed.
 * 3. Every accessed resource must independently resolve to the granted
 *    organisation (see assertResourceTenant) — prevents IDOR across tenants.
 * 4. Errors fail closed. An unexpected failure never widens access.
 */

import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { isSuperAdminRole } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import type { ApiAuth } from "@/lib/auth/resolveApiAuth";
import { findLatestGrant } from "./grants";
import {
  evaluateSupportAccess,
  grantRemainingMs,
  type SupportAccessGrant,
} from "./policy";
import { recordSupportAccessEvent, scopeAuditEvent, type SupportAccessEventType } from "./audit";
import type { SupportAccessScope } from "./scopes";

export type PrivilegedAccessContext = {
  auth: ApiAuth;
  clientId: string;
  scope: SupportAccessScope;
  grant: SupportAccessGrant | null;
  /** True for a tenant user operating inside their own organisation. */
  isTenantMember: boolean;
  expiresInMs: number;
};

export type PrivilegedAccessResult =
  | { ok: true; context: PrivilegedAccessContext }
  | { ok: false; error: NextResponse };

function deny(
  status: 400 | 401 | 403 | 404,
  body: { error: string; code?: string; message?: string }
): { ok: false; error: NextResponse } {
  return { ok: false, error: NextResponse.json(body, { status }) };
}

/**
 * Gate one client-data operation.
 *
 * Tenant users keep their existing RBAC-governed access to their own
 * organisation. Platform staff are denied unless they hold an ACTIVE, unexpired,
 * unrevoked Support Access grant for this organisation that includes `scope`.
 */
export async function requirePrivilegedTenantAccess(input: {
  req?: Request;
  clientId: string | null | undefined;
  scope: SupportAccessScope;
  /** Recorded on the audit trail when access succeeds. */
  resourceType?: string;
  resourceId?: string | null;
  /** Defaults to a scope-derived view event. */
  auditEvent?: SupportAccessEventType;
  /** Skip the access-audit row (lifecycle endpoints record their own). */
  skipAudit?: boolean;
}): Promise<PrivilegedAccessResult> {
  const auth = await getAuthFromRequest(input.req);
  if (!auth?.userId) {
    return deny(401, { error: "Unauthorized" });
  }

  const clientId = input.clientId?.trim() || null;
  if (!clientId) {
    return deny(400, { error: "Organisation context is required" });
  }

  // Impersonation runs as the customer identity — ordinary tenant rules apply.
  const isPlatformStaff = isSuperAdminRole(auth.role) && !auth.isImpersonating;

  if (!isPlatformStaff) {
    // Tenant isolation for customer roles is unchanged: own organisation only.
    if (auth.clientId !== clientId) {
      return deny(404, { error: "Not found" });
    }
    return {
      ok: true,
      context: {
        auth,
        clientId,
        scope: input.scope,
        grant: null,
        isTenantMember: true,
        expiresInMs: 0,
      },
    };
  }

  const ip = input.req ? clientIpFromRequest(input.req) : null;
  const userAgent = input.req ? userAgentFromRequest(input.req) : null;

  if (
    !hasPermission(
      {
        userId: auth.userId,
        role: auth.role,
        clientId: auth.clientId ?? null,
        isImpersonating: false,
      },
      P.SUPPORT_ACCESS_REQUEST
    )
  ) {
    return deny(403, {
      error: "Forbidden",
      code: "SUPPORT_ACCESS_NOT_PERMITTED",
      message: "Your platform role cannot access client data.",
    });
  }

  let grant: SupportAccessGrant | null = null;
  try {
    grant = await findLatestGrant(auth.userId, clientId);
  } catch (err) {
    // Fail closed: an unreadable grant store is not evidence of authorisation.
    console.warn(
      "[support-access] grant lookup failed:",
      err instanceof Error ? err.message : "unknown"
    );
    return deny(403, {
      error: "Forbidden",
      code: "SUPPORT_ACCESS_UNAVAILABLE",
      message: "Support Access could not be verified.",
    });
  }

  const decision = evaluateSupportAccess({
    grant,
    adminUserId: auth.userId,
    clientId,
    scope: input.scope,
  });

  if (!decision.ok) {
    void recordSupportAccessEvent({
      eventType: "SUPPORT_ACCESS_DENIED_ATTEMPT",
      clientId,
      grantId: grant?.id ?? null,
      actorUserId: auth.userId,
      actorRole: auth.role,
      scope: input.scope,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: "DENIED",
      ip,
      userAgent,
      metadata: { code: decision.code },
    });
    return deny(403, {
      error: "Forbidden",
      code: decision.code,
      message: decision.message,
    });
  }

  if (!input.skipAudit) {
    void recordSupportAccessEvent({
      eventType: input.auditEvent ?? scopeAuditEvent(input.scope),
      clientId,
      grantId: decision.grant.id,
      actorUserId: auth.userId,
      actorRole: auth.role,
      scope: input.scope,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      ip,
      userAgent,
      metadata: { reference: decision.grant.reference },
    });
  }

  return {
    ok: true,
    context: {
      auth,
      clientId,
      scope: input.scope,
      grant: decision.grant,
      isTenantMember: false,
      expiresInMs: decision.expiresInMs,
    },
  };
}

/** Default audit event for a scope when the caller does not name one. */
export { scopeAuditEvent } from "./audit";

/**
 * Independent tenant check for an already-loaded row.
 *
 * Even inside a valid Support Access session for organisation A, a record that
 * belongs to organisation B must not be returned. Callers pass the row's own
 * client_id — never the one from the request.
 */
export function assertResourceTenant(
  context: Pick<PrivilegedAccessContext, "clientId">,
  resourceClientId: string | null | undefined
): NextResponse | null {
  if (!resourceClientId || resourceClientId !== context.clientId) {
    // 404 rather than 403: do not confirm that the record exists elsewhere.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

/**
 * Read-only check for platform staff without the audit write or the 403 body.
 * Use for rendering decisions inside server components.
 */
export async function resolveSupportAccess(input: {
  userId: string;
  role: string;
  isImpersonating?: boolean;
  clientId: string;
  scope?: SupportAccessScope;
}): Promise<
  | { granted: true; grant: SupportAccessGrant; remainingMs: number }
  | { granted: false; grant: SupportAccessGrant | null }
> {
  if (!isSuperAdminRole(input.role) || input.isImpersonating) {
    return { granted: false, grant: null };
  }
  let grant: SupportAccessGrant | null = null;
  try {
    grant = await findLatestGrant(input.userId, input.clientId);
  } catch {
    return { granted: false, grant: null };
  }
  if (!grant) return { granted: false, grant: null };

  const decision = evaluateSupportAccess({
    grant,
    adminUserId: input.userId,
    clientId: input.clientId,
    // Any scope in the grant proves the session is live; callers needing a
    // specific category pass it explicitly.
    scope: input.scope ?? grant.scopes[0] ?? "LEADS",
  });
  if (!decision.ok) return { granted: false, grant };
  return {
    granted: true,
    grant: decision.grant,
    remainingMs: grantRemainingMs(decision.grant),
  };
}

/**
 * Convenience wrapper used by route handlers:
 * returns the NextResponse to send, or the verified context.
 */
export async function requireClientDataAccess(input: {
  req?: Request;
  clientId: string | null | undefined;
  scope: SupportAccessScope;
  resourceType?: string;
  resourceId?: string | null;
}): Promise<{ error: NextResponse; context?: undefined } | { context: PrivilegedAccessContext; error?: undefined }> {
  const result = await requirePrivilegedTenantAccess(input);
  if (!result.ok) return { error: result.error };
  return { context: result.context };
}
