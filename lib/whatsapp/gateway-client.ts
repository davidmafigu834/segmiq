import { signGatewayRequest } from "./security/gateway-auth";

function gatewayBase(): string {
  const value = process.env.WHATSAPP_GATEWAY_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("WHATSAPP_GATEWAY_URL is not configured");
  return value;
}

export async function callWhatsAppGateway<T>(input: {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
}): Promise<T> {
  const method = input.method ?? "POST";
  const body = input.body ? JSON.stringify(input.body) : "";
  const headers = await signGatewayRequest({ method, path: input.path, body });
  const response = await fetch(`${gatewayBase()}${input.path}`, {
    method,
    headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
    body: body || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `WhatsApp gateway returned HTTP ${response.status}`);
  return data;
}
