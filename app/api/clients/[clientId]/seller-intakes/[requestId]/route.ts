import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import { rejectClientScanStatus } from "@/lib/real-estate/seller-intake/scan";
import {
  acceptIntakeReview,
  attachSignedIntakeDocument,
  getSellerIntake,
  openIntakeDocument,
  reissueSellerIntake,
  requestIntakeCorrections,
  revokeSellerIntake,
  type IntakeActor,
} from "@/lib/real-estate/seller-intake/service";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["revoke", "reissue", "corrections", "accept_intake"]),
  purpose: z.enum(["initial", "resume"]).optional(),
  groups: z.array(z.string()).optional(),
  instruction: z.string().optional(),
  submissionVersion: z.number().int().positive().optional(),
  linkContactId: z.string().uuid().nullable().optional(),
  confirmNewContact: z.boolean().optional(),
  confirmChanges: z.boolean().optional(),
}).strict();

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): IntakeActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string; requestId: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId");
  if (documentId) {
    const opened = await openIntakeDocument({
      clientId: params.clientId,
      requestId: params.requestId,
      documentId,
      actor: actorFrom(g.session),
    });
    if (!opened.ok) return NextResponse.json({ error: opened.error }, { status: opened.status });
    return NextResponse.json({ url: opened.url, expiresInSeconds: opened.expiresInSeconds });
  }
  const result = await getSellerIntake({ clientId: params.clientId, requestId: params.requestId, actor: actorFrom(g.session) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string; requestId: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor = actorFrom(g.session);
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    if (form.get("scanStatus") || form.get("scan_status")) {
      return NextResponse.json({ error: "Scan status cannot be set by a request." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose the signed file." }, { status: 400 });
    const result = await attachSignedIntakeDocument({
      clientId: params.clientId,
      requestId: params.requestId,
      actor,
      filename: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ document: result.document, countsAsSignature: result.countsAsSignature });
  }
  const raw = await req.json().catch(() => null);
  if (rejectClientScanStatus(raw)) return NextResponse.json({ error: "Scan status cannot be set by a request." }, { status: 400 });
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const body = parsed.data;
  if (body.action === "revoke") {
    const result = await revokeSellerIntake({ clientId: params.clientId, requestId: params.requestId, actor });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "reissue") {
    const result = await reissueSellerIntake({
      clientId: params.clientId,
      requestId: params.requestId,
      actor,
      purpose: body.purpose === "resume" ? "resume" : "initial",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      request: result.request,
      link: `${new URL(req.url).origin}/seller-form/${result.token}`,
      expiresAt: result.expiresAt,
      behaviour: result.behaviour,
    });
  }
  if (body.action === "corrections") {
    const result = await requestIntakeCorrections({
      clientId: params.clientId,
      requestId: params.requestId,
      actor,
      groups: body.groups ?? [],
      instruction: body.instruction ?? "",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      request: result.request,
      link: `${new URL(req.url).origin}/seller-form/${result.token}`,
      expiresAt: result.expiresAt,
      behaviour: result.behaviour,
    });
  }
  const result = await acceptIntakeReview({
    clientId: params.clientId,
    requestId: params.requestId,
    actor,
    submissionVersion: body.submissionVersion ?? 0,
    linkContactId: body.linkContactId,
    confirmNewContact: body.confirmNewContact,
    confirmChanges: body.confirmChanges,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, duplicates: "duplicates" in result ? result.duplicates : undefined, differences: "differences" in result ? result.differences : undefined },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}
