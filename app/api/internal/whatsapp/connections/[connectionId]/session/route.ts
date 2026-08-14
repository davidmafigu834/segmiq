import { NextResponse } from "next/server";
import { clearWhatsAppSession, getWhatsAppConnectionById, readWhatsAppSession, storeWhatsAppSession } from "@/lib/whatsapp/connections";
import { verifyInternalWhatsAppRequest } from "@/lib/whatsapp/security/verify-internal-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { connectionId: string } }) {
  const auth = await verifyInternalWhatsAppRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const session = await readWhatsAppSession(params.connectionId);
  if (!session) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  return NextResponse.json(session, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request, { params }: { params: { connectionId: string } }) {
  const raw = await request.text();
  const auth = await verifyInternalWhatsAppRequest(request, raw);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const connection = await getWhatsAppConnectionById(params.connectionId);
  if (!connection || connection.providerType !== "TEMPORARY_WEB") {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  const payload = JSON.parse(raw) as { serializedSession?: string };
  if (!payload.serializedSession || payload.serializedSession.length > 10_000_000) {
    return NextResponse.json({ error: "Invalid session payload" }, { status: 400 });
  }
  await storeWhatsAppSession({
    connectionId: connection.id,
    clientId: connection.clientId,
    serializedSession: payload.serializedSession,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { connectionId: string } }) {
  const auth = await verifyInternalWhatsAppRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  await clearWhatsAppSession(params.connectionId);
  return NextResponse.json({ ok: true });
}
