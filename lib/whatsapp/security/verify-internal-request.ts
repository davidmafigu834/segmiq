import { consumeGatewayNonce } from "../connections";
import { verifyGatewayRequest } from "./gateway-auth";

export async function verifyInternalWhatsAppRequest(
  request: Request,
  body = ""
): Promise<{ ok: true } | { ok: false; error: string }> {
  let verification: Awaited<ReturnType<typeof verifyGatewayRequest>>;
  try {
    verification = await verifyGatewayRequest({
      headers: request.headers,
      method: request.method,
      path: new URL(request.url).pathname,
      body,
    });
  } catch {
    return { ok: false, error: "Gateway authentication is not configured" };
  }
  if (!verification.ok) return { ok: false, error: verification.reason };
  if (!(await consumeGatewayNonce(verification.nonce, verification.expiresAt))) {
    return { ok: false, error: "Gateway request was already used" };
  }
  return { ok: true };
}
