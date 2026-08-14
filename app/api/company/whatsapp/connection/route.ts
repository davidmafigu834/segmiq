import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireWhatsAppConnectionAdmin } from "@/lib/whatsapp/connection-auth";
import { getSafeWhatsAppConnection, readWhatsAppQrChallenge } from "@/lib/whatsapp/connections";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireWhatsAppConnectionAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const connection = await getSafeWhatsAppConnection(auth.admin.clientId);
  let qrDataUrl: string | null = null;
  let qrExpired = false;
  if (
    connection.connectionId &&
    connection.providerType === "TEMPORARY_WEB" &&
    connection.status === "AWAITING_QR" &&
    connection.temporaryFeatureEnabled &&
    connection.temporaryBetaEligible
  ) {
    const challenge = await readWhatsAppQrChallenge(connection.connectionId, auth.admin.clientId);
    qrExpired = Boolean(challenge.expiresAt && !challenge.qr);
    if (challenge.qr) {
      qrDataUrl = await QRCode.toDataURL(challenge.qr, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 360,
        color: { dark: "#101828", light: "#FFFFFF" },
      });
    }
  }
  return NextResponse.json(
    { connection, qrDataUrl, qrExpired },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate", pragma: "no-cache" } }
  );
}
