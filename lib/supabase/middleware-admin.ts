/**
 * Edge-safe PostgREST reads for middleware.
 *
 * Do not import `@supabase/supabase-js` here. The JS client bloats the Edge
 * bundle and its fetches have no timeout, which is what produces
 * ROUTING_MIDDLEWARE_HAS_TIMED_OUT on /client/dashboard.
 */

export const MIDDLEWARE_DB_TIMEOUT_MS = 2_000;

export type MiddlewareFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export function middlewareRestUrl(baseUrl: string, table: string, query: string): string {
  return `${baseUrl.replace(/\/$/, "")}/rest/v1/${table}?${query}`;
}

export function sessionVersionQuery(userId: string): string {
  return `select=session_version&id=eq.${encodeURIComponent(userId)}`;
}

export function crmSubscriptionQuery(clientId: string): string {
  return `select=status&client_id=eq.${encodeURIComponent(clientId)}&product=eq.crm&limit=1`;
}

export async function fetchMiddlewareFirstRow<T extends Record<string, unknown>>(
  table: string,
  query: string,
  options?: { fetchImpl?: MiddlewareFetch; timeoutMs?: number }
): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? MIDDLEWARE_DB_TIMEOUT_MS;

  try {
    const res = await fetchImpl(middlewareRestUrl(url, table, query), {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    return (data[0] ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Returns the DB session version, or null when the check must fail open. */
export async function fetchMiddlewareSessionVersion(
  userId: string,
  options?: { fetchImpl?: MiddlewareFetch; timeoutMs?: number }
): Promise<number | null> {
  const row = await fetchMiddlewareFirstRow<{ session_version?: number }>(
    "users",
    sessionVersionQuery(userId),
    options
  );
  if (!row) return null;
  return Number(row.session_version ?? 0);
}

/** Returns the CRM subscription status, or null when the check must fail open. */
export async function fetchMiddlewareCrmSubscriptionStatus(
  clientId: string,
  options?: { fetchImpl?: MiddlewareFetch; timeoutMs?: number }
): Promise<string | null> {
  const row = await fetchMiddlewareFirstRow<{ status?: string }>(
    "subscriptions",
    crmSubscriptionQuery(clientId),
    options
  );
  return row?.status ?? null;
}
