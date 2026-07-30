import { createAdminClient } from "@/lib/supabase/admin";
import { sendTokenExpiryAlert } from "@/lib/notifications";
import { fbLog } from "@/lib/facebook/log";

export type GraphError = {
  code: number;
  subcode?: number;
  type: string;
  message: string;
  fbtrace_id?: string;
};

export type GraphResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: GraphError; tokenExpired: boolean };

const TOKEN_EXPIRY_CODES = new Set([190]);
const TOKEN_EXPIRY_SUBCODES = new Set([463, 467, 458, 460, 464]);

export function isTokenExpiredError(err: GraphError): boolean {
  if (TOKEN_EXPIRY_CODES.has(err.code)) return true;
  if (err.subcode != null && TOKEN_EXPIRY_SUBCODES.has(err.subcode)) return true;
  return false;
}

export function getFacebookGraphBase(): string {
  const version = process.env.FACEBOOK_API_VERSION || "v19.0";
  return `https://graph.facebook.com/${version}`;
}

function normalizeGraphError(parsed: { error?: Record<string, unknown> }, resStatus: number): GraphError {
  const e = parsed.error;
  if (e && typeof e === "object") {
    const code = Number(e.code ?? resStatus);
    const subRaw = e.error_subcode ?? e.subcode;
    const subcode = subRaw != null ? Number(subRaw) : undefined;
    return {
      code: Number.isFinite(code) ? code : resStatus,
      subcode: Number.isFinite(subcode as number) ? (subcode as number) : undefined,
      type: String(e.type ?? "OAuthException"),
      message: String(e.message ?? "Unknown Graph error"),
      fbtrace_id: e.fbtrace_id != null ? String(e.fbtrace_id) : undefined,
    };
  }
  return {
    code: resStatus,
    type: "HttpError",
    message: `HTTP ${resStatus}`,
  };
}

type GraphCallOptions = {
  clientId?: string;
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown> | URLSearchParams;
  timeoutMs?: number;
};

async function handleTokenExpiry(clientId: string, err: GraphError): Promise<void> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("clients")
    .select("fb_token_expired_at")
    .eq("id", clientId)
    .maybeSingle();

  const prevIso = (row as { fb_token_expired_at?: string | null } | null)?.fb_token_expired_at ?? null;
  const prevMs = prevIso ? new Date(prevIso).getTime() : 0;
  const shouldAlert = !prevIso || Date.now() - prevMs > 24 * 60 * 60 * 1000;

  await supabase
    .from("clients")
    .update({
      fb_webhook_verified: false,
      fb_token_expired_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  fbLog("fb.token.expired", { clientId, code: err.code, subcode: err.subcode });

  const { data: clientRow } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  const clientName = (clientRow as { name?: string } | null)?.name ?? "Client";

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "SUPER_ADMIN")
    .eq("is_active", true);

  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const adminIds = (admins ?? []).map((a) => a.id as string);
  if (adminIds.length && clientRow) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "FB_TOKEN_EXPIRED")
      .eq("client_id", clientId)
      .gte("created_at", recentCutoff)
      .in("user_id", adminIds);
    const existingUserIds = new Set((existing ?? []).map((e) => e.user_id as string));
    const toInsert = adminIds
      .filter((id) => !existingUserIds.has(id))
      .map((user_id) => ({
        user_id,
        type: "FB_TOKEN_EXPIRED" as const,
        message: `Facebook connection expired for ${clientName}`,
        lead_id: null as string | null,
        client_id: clientId,
        read: false,
      }));
    if (toInsert.length > 0) {
      await supabase.from("notifications").insert(toInsert);
    }
  }

  if (shouldAlert) {
    try {
      await sendTokenExpiryAlert(clientId);
      fbLog("fb.token.alert_sent", { clientId });
    } catch (alertErr) {
      console.error("[fb] token expiry alert failed", { clientId, alertErr });
    }
  }
}

export async function graphCall<T = unknown>(
  path: string,
  accessToken: string,
  opts: GraphCallOptions = {}
): Promise<GraphResult<T>> {
  const { method = "GET", body, timeoutMs = 15000, clientId } = opts;

  const base = getFacebookGraphBase();
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const finalUrl = new URL(url);
  if ((method === "GET" || method === "DELETE") && !finalUrl.searchParams.has("access_token")) {
    finalUrl.searchParams.set("access_token", accessToken);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let finalBody: string | undefined;
  const headers: Record<string, string> = {};

  if (method === "POST") {
    if (body instanceof URLSearchParams) {
      body.set("access_token", accessToken);
      finalBody = body.toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else {
      finalBody = JSON.stringify({ ...(body ?? {}), access_token: accessToken });
      headers["Content-Type"] = "application/json";
    }
  }

  try {
    const res = await fetch(finalUrl.toString(), {
      method,
      headers,
      body: finalBody,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        error: { code: -1, type: "ParseError", message: "Invalid JSON from Graph API" },
        tokenExpired: false,
      };
    }

    const graphErrObj = parsed.error as Record<string, unknown> | undefined;
    if (!res.ok || graphErrObj) {
      const err = normalizeGraphError(parsed as { error?: Record<string, unknown> }, res.status);
      const tokenExpired = isTokenExpiredError(err);

      if (tokenExpired && clientId) {
        await handleTokenExpiry(clientId, err);
      }

      return { ok: false, error: err, tokenExpired };
    }

    return { ok: true, data: parsed as T };
  } catch (err: unknown) {
    clearTimeout(timer);
    const e = err as { name?: string; message?: string };
    if (e.name === "AbortError") {
      return {
        ok: false,
        error: { code: -2, type: "Timeout", message: `Request timed out after ${timeoutMs}ms` },
        tokenExpired: false,
      };
    }
    return {
      ok: false,
      error: { code: -3, type: "NetworkError", message: e.message || "Unknown error" },
      tokenExpired: false,
    };
  }
}
