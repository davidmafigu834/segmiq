import { NextResponse } from "next/server";
import { requireWhatsAppTenantMember } from "@/lib/whatsapp/connection-auth";
import { getSafeWhatsAppConnection } from "@/lib/whatsapp/connections";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireWhatsAppTenantMember();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const connection = await getSafeWhatsAppConnection(auth.clientId);
  return NextResponse.json({ connection }, { headers: { "cache-control": "no-store" } });
}
