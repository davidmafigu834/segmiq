import { signGatewayRequest } from "./security/gateway-auth";

export const GATEWAY_SEND_TIMEOUT_MS = 12_000;
/** Stay under Vercel Hobby's 10s function cap so a restarting gateway can return 202 instead of a hard timeout. */
export const GATEWAY_CONNECT_TIMEOUT_MS = 8_000;
export const GATEWAY_WAKE_TIMEOUT_MS = 8_000;

function gatewayBase(): string {
  const value = process.env.WHATSAPP_GATEWAY_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("WHATSAPP_GATEWAY_URL is not configured");
  return value;
}

export function isGatewayTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /aborted due to timeout|operation was aborted|the operation timed out/i.test(message)
  );
}

export function gatewayUserError(error: unknown): string {
  if (isGatewayTimeoutError(error)) {
    return "The WhatsApp service is still starting after a deploy or restart. Wait a few seconds, then try again.";
  }
  return error instanceof Error ? error.message : "WhatsApp gateway unavailable";
}

export async function wakeWhatsAppGateway(
  timeoutMs = GATEWAY_WAKE_TIMEOUT_MS
): Promise<{ ok: boolean; waking: boolean }> {
  try {
    const response = await fetch(`${gatewayBase()}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
    return { ok: response.ok && data.ok !== false, waking: false };
  } catch (error) {
    if (isGatewayTimeoutError(error)) return { ok: false, waking: true };
    return { ok: false, waking: false };
  }
}

export async function callWhatsAppGateway<T>(input: {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const method = input.method ?? "POST";
  const body = input.body ? JSON.stringify(input.body) : "";
  const headers = await signGatewayRequest({ method, path: input.path, body });
  const response = await fetch(`${gatewayBase()}${input.path}`, {
    method,
    headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
    body: body || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(input.timeoutMs ?? GATEWAY_SEND_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `WhatsApp gateway returned HTTP ${response.status}`);
  return data;
}
