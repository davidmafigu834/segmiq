import { NextResponse } from "next/server";
import { requireWhatsAppConnectionAdmin } from "@/lib/whatsapp/connection-auth";
import { clearWhatsAppSession, getPrimaryWhatsAppConnection, recordWhatsAppConnectionEvent, transitionWhatsAppConnection } from "@/lib/whatsapp/connections";
import { callWhatsAppGateway } from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireWhatsAppConnectionAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const connection = await getPrimaryWhatsAppConnection(auth.admin.clientId);
  if (!connection || connection.providerType !== "TEMPORARY_WEB") {
    return NextResponse.json({ error: "No quick connection exists" }, { status: 404 });
  }
  try {
    if (connection.status !== "DISCONNECTED") {
      await transitionWhatsAppConnection({ connectionId: connection.id, to: "DISCONNECTING" });
    }
    await callWhatsAppGateway({
      path: `/v1/connections/${encodeURIComponent(connection.id)}`,
      method: "DELETE",
    }).catch(() => null);
    await clearWhatsAppSession(connection.id);
    const refreshed = await getPrimaryWhatsAppConnection(auth.admin.clientId);
    if (refreshed && refreshed.status !== "DISCONNECTED") {
      await transitionWhatsAppConnection({ connectionId: connection.id, to: "DISCONNECTED" });
    }
    await recordWhatsAppConnectionEvent({
      connectionId: connection.id,
      clientId: auth.admin.clientId,
      actorId: auth.admin.userId,
      eventType: "CONNECTION_DISCONNECTED",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Disconnect failed" }, { status: 500 });
  }
}
