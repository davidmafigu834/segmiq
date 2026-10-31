import { NextResponse } from "next/server";
import { requireClientDataAccess } from "@/lib/security/support-access";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import {
  loadComplianceActor,
  signComplianceDocument,
  uploadComplianceDocument,
} from "@/lib/real-estate/compliance-service";
import { detectComplianceFileType } from "@/lib/real-estate/compliance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; caseId: string; docId: string } }
) {
  const access = await requireClientDataAccess({ req, clientId: params.clientId, scope: "COMPLIANCE", resourceType: "compliance_document", resourceId: params.docId });
  if (access.error) return access.error;
  const session = access.context.auth;
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }
  const actor = await loadComplianceActor(session, access.context.clientId, !access.context.isTenantMember);
  const result = await signComplianceDocument({
    clientId: params.clientId,
    caseId: params.caseId,
    documentId: params.docId,
    actor,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url, expiresAt: new Date(Date.now() + 300000).toISOString(), expiresInSeconds: 300 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; caseId: string; docId: string } }
) {
  const access = await requireClientDataAccess({ req, clientId: params.clientId, scope: "COMPLIANCE", resourceType: "compliance_document", resourceId: params.docId });
  if (access.error) return access.error;
  const session = access.context.auth;
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const actor = await loadComplianceActor(session, access.context.clientId, !access.context.isTenantMember);
  const contentTypeHeader = req.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { reuse_storage_key?: string };
    const result = await uploadComplianceDocument({
      clientId: params.clientId,
      caseId: params.caseId,
      documentId: params.docId,
      actor,
      file: { buffer: Buffer.alloc(0), filename: "reused", contentType: "application/octet-stream" },
      reuseStorageKey: body.reuse_storage_key ?? null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File is too large (max 20MB)." }, { status: 400 });
  }
  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Upload a PDF or image." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectComplianceFileType(buffer);
  if (!detectedType || (detectedType !== type && !(detectedType === "image/heic" && (type === "image/heic" || type === "image/heif")))) {
    return NextResponse.json({ error: "The file contents do not match an allowed PDF or image type." }, { status: 400 });
  }
  const result = await uploadComplianceDocument({
    clientId: params.clientId,
    caseId: params.caseId,
    documentId: params.docId,
    actor,
    file: { buffer, filename: file.name, contentType: detectedType },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
