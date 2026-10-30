/**
 * CRM subscription gate for SegmiQ Sales app API requests.
 *
 * Edge-safe (runs in middleware). Applies the same billing decision as the web
 * portal gate (fetchMiddlewareCrmBillingAccessStatus): only "suspended" blocks,
 * and a failed or timed-out read fails open exactly like the page gate.
 *
 * Scope: Bearer tokens issued to the Sales app. Cookie (web) API requests and
 * Cloud field-app tokens are deliberately not gated here.
 */

import type { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/auth/roles";
import {
  fetchMiddlewareCrmBillingAccessStatus,
  fetchMiddlewareFirstRowResult,
  type MiddlewareFetch,
} from "@/lib/supabase/middleware-admin";
import { mobileApiError } from "@/lib/mobile/sales-app/errors";

/** `channel` JWT claim on tokens issued to the SegmiQ Sales app. */
export const SALES_APP_TOKEN_CHANNEL = "sales_app";

/** user_sessions.metadata.channel values written by Sales app logins. */
const SALES_APP_SESSION_CHANNELS = new Set(["sales_app", "mobile_sales"]);

const BILLING_CACHE_TTL_MS = 30_000;
const CHANNEL_CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 1_000;

type CacheEntry<T> = { value: T; at: number };
const billingCache = new Map<string, CacheEntry<string>>();
const channelCache = new Map<string, CacheEntry<boolean>>();

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string, ttlMs: number, now: number): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at >= ttlMs) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, now: number) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
  cache.set(key, { value, at: now });
}

export function clearSubscriptionGateCaches(): void {
  billingCache.clear();
  channelCache.clear();
}

/** Login, logout, MFA, session management, bootstrap, billing and health stay reachable. */
export function isSubscriptionGateExemptPath(pathname: string): boolean {
  const p = pathname.split("?")[0] || pathname;
  if (p === "/api/auth" || p.startsWith("/api/auth/")) return true;
  if (p === "/api/sales/app/auth" || p === "/api/sales/app/bootstrap" || p === "/api/sales/app/download") {
    return true;
  }
  if (p === "/api/billing" || p.startsWith("/api/billing/")) return true;
  if (p === "/api/health" || p === "/api/status" || p.startsWith("/api/status/")) return true;
  if (p === "/api/users/me/security-meta") return true;
  return false;
}

export type SalesAppBearerClaims = {
  [claim: string]: unknown;
  role?: unknown;
  clientId?: unknown;
  sessionId?: unknown;
  channel?: unknown;
};

type GateOptions = {
  fetchImpl?: MiddlewareFetch;
  now?: Date;
};

export function userSessionChannelQuery(sessionId: string): string {
  return `select=metadata&id=eq.${encodeURIComponent(sessionId)}&limit=1`;
}

/**
 * Tokens issued after this change carry `channel: "sales_app"`. Older Sales
 * tokens (and Cloud tokens) have no claim, so the session row's metadata
 * decides. An unreadable session row is treated as not-Sales (fail open).
 */
export async function isSalesAppBearer(
  claims: SalesAppBearerClaims,
  options: GateOptions = {}
): Promise<boolean> {
  if (typeof claims.channel === "string") return claims.channel === SALES_APP_TOKEN_CHANNEL;
  const sessionId = typeof claims.sessionId === "string" ? claims.sessionId : null;
  if (!sessionId) return false;
  const now = (options.now ?? new Date()).getTime();
  const cached = cacheGet(channelCache, sessionId, CHANNEL_CACHE_TTL_MS, now);
  if (cached !== undefined) return cached;
  const result = await fetchMiddlewareFirstRowResult<{ metadata?: { channel?: unknown } | null }>(
    "user_sessions",
    userSessionChannelQuery(sessionId),
    { fetchImpl: options.fetchImpl }
  );
  if (result.status === "unavailable") return false;
  const channel = result.status === "found" ? result.row.metadata?.channel : null;
  const isSales = typeof channel === "string" && SALES_APP_SESSION_CHANNELS.has(channel);
  cacheSet(channelCache, sessionId, isSales, now);
  return isSales;
}

export async function crmBillingStatusForGate(
  clientId: string,
  options: GateOptions = {}
): Promise<string | null> {
  const now = options.now ?? new Date();
  const cached = cacheGet(billingCache, clientId, BILLING_CACHE_TTL_MS, now.getTime());
  if (cached !== undefined) return cached;
  const status = await fetchMiddlewareCrmBillingAccessStatus(clientId, {
    fetchImpl: options.fetchImpl,
    now,
  });
  if (status !== null) cacheSet(billingCache, clientId, status, now.getTime());
  return status;
}

export function subscriptionSuspendedResponse(): NextResponse {
  return mobileApiError("SUBSCRIPTION_SUSPENDED", { error: "SUBSCRIPTION_SUSPENDED" });
}

/**
 * Returns a 402 SUBSCRIPTION_SUSPENDED response when a verified Sales app
 * Bearer token belongs to an organisation whose CRM subscription is suspended.
 * Returns null to let the request continue. Callers must verify the JWT
 * signature before calling this.
 */
export async function evaluateSalesAppSubscriptionGate(
  pathname: string,
  claims: SalesAppBearerClaims,
  options: GateOptions = {}
): Promise<NextResponse | null> {
  if (isSubscriptionGateExemptPath(pathname)) return null;
  const role = normalizeUserRole(typeof claims.role === "string" ? claims.role : null);
  if (role !== "SALESPERSON" && role !== "CLIENT_MANAGER") return null;
  const clientId = typeof claims.clientId === "string" && claims.clientId ? claims.clientId : null;
  if (!clientId) return null;
  if (!(await isSalesAppBearer(claims, options))) return null;
  const status = await crmBillingStatusForGate(clientId, options);
  return status === "suspended" ? subscriptionSuspendedResponse() : null;
}
