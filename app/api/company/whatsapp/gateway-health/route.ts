import { NextResponse } from "next/server";
import { requireWhatsAppConnectionAdmin } from "@/lib/whatsapp/connection-auth";
import { isTemporaryWhatsAppFeatureEnabled } from "@/lib/whatsapp/feature-flags";
import { wakeWhatsAppGateway } from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Wake a sleeping Render gateway before QR connect. Public /health only. */
export async function GET() {
  const auth = await requireWhatsAppConnectionAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isTemporaryWhatsAppFeatureEnabled()) {
    return NextResponse.json({ error: "Quick connection is not enabled" }, { status: 404 });
  }
  try {
    const result = await wakeWhatsAppGateway();
    return NextResponse.json(result, { status: result.ok ? 200 : result.waking ? 202 : 503 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gateway unreachable" },
      { status: 503 }
    );
  }
}
