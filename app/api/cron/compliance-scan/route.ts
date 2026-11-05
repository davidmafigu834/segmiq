import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { scanPendingEvidence, scanStoredEvidence } from "@/lib/real-estate/compliance-management/service";
import { scannerConfigured } from "@/lib/real-estate/compliance-management/scanner";
import { scanPendingSellerDocuments, scanSellerDocument } from "@/lib/real-estate/seller-intake/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { evidenceId?: unknown; clientId?: unknown; scanStatus?: unknown } | null;
  if (body && typeof body === "object" && "scanStatus" in body) {
    return NextResponse.json({ error: "Scan status cannot be set by a request.", code: "SCAN_STATUS_REJECTED" }, { status: 400 });
  }
  if (!scannerConfigured()) {
    return NextResponse.json({ ok: false, code: "SCANNER_NOT_CONFIGURED", error: "The compliance scanner is not configured. Files stay blocked." }, { status: 503 });
  }
  const sellerDocumentId = body && typeof body === "object" && "sellerDocumentId" in body ? (body as { sellerDocumentId?: unknown }).sellerDocumentId : undefined;
  if (typeof sellerDocumentId === "string" && typeof body?.clientId === "string") {
    const result = await scanSellerDocument({ clientId: body.clientId, documentId: sellerDocumentId });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  }
  if (typeof body?.evidenceId === "string" && typeof body.clientId === "string") {
    const result = await scanStoredEvidence({ clientId: body.clientId, evidenceId: body.evidenceId });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  }
  const result = await scanPendingEvidence();
  const sellerDocuments = await scanPendingSellerDocuments();
  return NextResponse.json({ ...result, sellerDocuments }, { status: result.ok ? 200 : 503 });
}
