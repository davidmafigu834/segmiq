import { NextResponse } from "next/server";
import { requireWhatsAppConnectionAdmin } from "@/lib/whatsapp/connection-auth";
import { createOrResetTemporaryConnection, getPrimaryWhatsAppConnection } from "@/lib/whatsapp/connections";
import { assertTemporaryWhatsAppRuntimeConfigured, isTemporaryWhatsAppFeatureEnabled } from "@/lib/whatsapp/feature-flags";
import { callWhatsAppGateway } from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireWhatsAppConnectionAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isTemporaryWhatsAppFeatureEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const current = await getPrimaryWhatsAppConnection(auth.admin.clientId);
  if (!current || current.providerType !== "TEMPORARY_WEB") {
    return NextResponse.json({ error: "No quick connection exists" }, { status: 404 });
  }
  try {
    assertTemporaryWhatsAppRuntimeConfigured();
    const connection = await createOrResetTemporaryConnection({
      clientId: auth.admin.clientId,
      actorId: auth.admin.userId,
    });
    await callWhatsAppGateway({
      path: `/v1/connections/${encodeURIComponent(connection.id)}/connect`,
      body: { reconnect: true },
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reconnect failed" }, { status: 503 });
  }
}
