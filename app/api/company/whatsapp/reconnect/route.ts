import { NextResponse } from "next/server";
import { requireWhatsAppConnectionAdmin } from "@/lib/whatsapp/connection-auth";
import { ensureTemporaryWebConnection, getPrimaryWhatsAppConnection } from "@/lib/whatsapp/connections";
import { assertTemporaryWhatsAppRuntimeConfigured, isTemporaryWhatsAppFeatureEnabled } from "@/lib/whatsapp/feature-flags";
import {
  callWhatsAppGateway,
  GATEWAY_CONNECT_TIMEOUT_MS,
  gatewayUserError,
  isGatewayTimeoutError,
} from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireWhatsAppConnectionAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isTemporaryWhatsAppFeatureEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const current = await getPrimaryWhatsAppConnection(auth.admin.clientId);
  if (!current || current.providerType !== "TEMPORARY_WEB") {
    return NextResponse.json({ error: "No quick connection exists" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { resume?: boolean };
  const resume = body.resume === true;
  try {
    assertTemporaryWhatsAppRuntimeConfigured();
    const connection = await ensureTemporaryWebConnection({
      clientId: auth.admin.clientId,
      actorId: auth.admin.userId,
      resume,
    });
    try {
      await callWhatsAppGateway({
        path: `/v1/connections/${encodeURIComponent(connection.id)}/connect`,
        body: { reconnect: true },
        timeoutMs: GATEWAY_CONNECT_TIMEOUT_MS,
      });
    } catch (error) {
      if (isGatewayTimeoutError(error)) {
        return NextResponse.json({ ok: true, waking: true }, { status: 202 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: gatewayUserError(error) }, { status: 503 });
  }
}
