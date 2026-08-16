import { NextResponse } from "next/server";
import {
  listRestorableTemporaryConnections,
  recordWhatsAppConnectionEvent,
  transitionWhatsAppConnection,
} from "@/lib/whatsapp/connections";
import { verifyInternalWhatsAppRequest } from "@/lib/whatsapp/security/verify-internal-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Called by the gateway on startup so a restart does not force every beta
 * company to scan a new QR code. Each returned connection is moved to
 * RECONNECTING first: the stored status may still say CONNECTED from before
 * the restart, and reporting a live socket that no longer exists would let
 * salespeople send into a dead transport.
 */
export async function GET(request: Request) {
  const auth = await verifyInternalWhatsAppRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const restorable = await listRestorableTemporaryConnections();
  const connections: Array<{ connectionId: string }> = [];

  for (const entry of restorable) {
    try {
      await transitionWhatsAppConnection({ connectionId: entry.connectionId, to: "RECONNECTING" });
      await recordWhatsAppConnectionEvent({
        connectionId: entry.connectionId,
        clientId: entry.clientId,
        eventType: "GATEWAY_RESTORE_REQUESTED",
      });
      connections.push({ connectionId: entry.connectionId });
    } catch {
      // A connection in an unexpected state is skipped rather than failing the
      // whole restore sweep for every other tenant.
    }
  }

  return NextResponse.json({ connections }, { headers: { "cache-control": "no-store" } });
}
