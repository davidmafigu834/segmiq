import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  assertTransactionWorkAccess,
  linkTransactionDocument,
  transactionDocumentForDownload,
  type AgencyActor,
} from "@/lib/real-estate/agency-service";
import {
  deleteObject,
  generatePresignedDownloadUrl,
  generateTransactionDocumentKey,
  isR2Configured,
  isTransactionDocumentKeyForClient,
  putObject,
} from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["heic", "image/heic"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);
const VISIBILITY = new Set(["participants", "managers", "finance"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): AgencyActor {
  return { id: session.userId, name: session.user?.name ?? "User", role: session.role, clientId: session.clientId };
}

/** Signed, short-lived download link for a document the actor may see. */
export async function GET(req: Request, { params }: { params: { clientId: string; transactionId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const linkId = new URL(req.url).searchParams.get("documentLinkId") ?? "";
  if (!UUID.test(linkId)) return NextResponse.json({ error: "Choose a document." }, { status: 400 });
  const result = await transactionDocumentForDownload(params.clientId, actorFrom(g.session), linkId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isTransactionDocumentKeyForClient(params.clientId, result.storageKey)) {
    return NextResponse.json({ error: "This file is not stored for this organisation." }, { status: 404 });
  }
  if (!isR2Configured()) return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
  const ext = result.filename.split(".").pop()?.toLowerCase() ?? "";
  const url = await generatePresignedDownloadUrl(result.storageKey, result.filename, ALLOWED_TYPES.get(ext) ?? "application/octet-stream");
  return NextResponse.json({ url, expiresInSeconds: 300 });
}

/** Stores a private file and links it to the transaction as awaiting review. Upload is not verification. */
export async function POST(req: Request, { params }: { params: { clientId: string; transactionId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor = actorFrom(g.session);
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  const file = form.get("file");
  const category = String(form.get("category") ?? "").trim().slice(0, 80);
  const visibilityRaw = String(form.get("visibility") ?? "").trim();
  const milestoneId = String(form.get("milestoneId") ?? "").trim();
  const replacesId = String(form.get("replacesDocumentLinkId") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (!category) return NextResponse.json({ error: "Choose a document type." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 4 MB or smaller." }, { status: 400 });
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = ALLOWED_TYPES.get(ext);
  if (!contentType) return NextResponse.json({ error: "Upload a PDF, image or Word document." }, { status: 400 });
  if (milestoneId && !UUID.test(milestoneId)) return NextResponse.json({ error: "Invalid milestone." }, { status: 400 });
  if (replacesId && !UUID.test(replacesId)) return NextResponse.json({ error: "Invalid document." }, { status: 400 });

  const access = await assertTransactionWorkAccess(params.clientId, actor, params.transactionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!isR2Configured()) return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });

  const key = generateTransactionDocumentKey(params.clientId, params.transactionId, file.name);
  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), contentType, {
      contentDisposition: "attachment",
      cacheControl: "private, no-store",
    });
  } catch (error) {
    console.error("[transaction-documents] upload failed", error);
    return NextResponse.json({ error: "Could not store the file." }, { status: 500 });
  }

  const result = await linkTransactionDocument({
    clientId: params.clientId,
    actor,
    transactionId: params.transactionId,
    storageKey: key,
    filename: file.name.slice(0, 200),
    category,
    visibility: VISIBILITY.has(visibilityRaw) ? (visibilityRaw as "participants" | "managers" | "finance") : null,
    milestoneId: milestoneId || null,
    replacesDocumentLinkId: replacesId || null,
  });
  if (!result.ok) {
    await deleteObject(key).catch(() => undefined);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
