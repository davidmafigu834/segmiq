/**
 * PostgREST reads for login. Avoids @supabase/supabase-js so auth can time out cleanly
 * and log HTTP failures (for example an invalid service_role key on Vercel).
 */

import { middlewareRestUrl } from "@/lib/supabase/middleware-admin";

export const AUTH_DB_TIMEOUT_MS = 5_000;
export const AUTH_CLIENT_MODE_TIMEOUT_MS = 2_000;

export type AuthUserRow = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  client_id: string | null;
  is_active: boolean;
  session_version?: number;
  also_sells?: boolean;
};

export type AuthFetchFailureReason = "missing_env" | "timeout" | "http_error" | "not_found";

export type AuthFetchResult<T> =
  | { ok: true; row: T }
  | { ok: false; reason: AuthFetchFailureReason; status?: number; detail?: string };

function authHeaders(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
}

export function authUserByEmailQuery(email: string): string {
  return [
    "select=id,name,email,password,role,client_id,is_active,session_version,also_sells",
    `email=eq.${encodeURIComponent(email)}`,
    "limit=1",
  ].join("&");
}

export function clientModeQuery(clientId: string): string {
  return `select=mode&id=eq.${encodeURIComponent(clientId)}&limit=1`;
}

export async function fetchAuthFirstRow<T extends Record<string, unknown>>(
  table: string,
  query: string,
  timeoutMs = AUTH_DB_TIMEOUT_MS
): Promise<AuthFetchResult<T>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, reason: "missing_env", detail: "Supabase env vars are not configured" };
  }

  try {
    const res = await fetch(middlewareRestUrl(url, table, query), {
      headers: authHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 240);
      return { ok: false, reason: "http_error", status: res.status, detail };
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, row: data[0] as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    if (/abort|timeout/i.test(message)) {
      return { ok: false, reason: "timeout", detail: message };
    }
    return { ok: false, reason: "http_error", detail: message };
  }
}

export async function fetchAuthUserByEmail(
  email: string,
  timeoutMs = AUTH_DB_TIMEOUT_MS
): Promise<AuthFetchResult<AuthUserRow>> {
  return fetchAuthFirstRow<AuthUserRow>("users", authUserByEmailQuery(email), timeoutMs);
}

export async function fetchClientMode(
  clientId: string,
  timeoutMs = AUTH_CLIENT_MODE_TIMEOUT_MS
): Promise<"solo" | "team"> {
  const result = await fetchAuthFirstRow<{ mode?: string }>(
    "clients",
    clientModeQuery(clientId),
    timeoutMs
  );
  if (!result.ok) return "team";
  return result.row.mode === "solo" ? "solo" : "team";
}
