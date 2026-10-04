import { NextResponse } from "next/server";
import { portalOriginOk } from "@/lib/portal/auth";
import { getPortalIdentity, submitPortalProof } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  if (!portalOriginOk(req)) return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  const identity = await getPortalIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const amount = Number(form?.get("amount"));
  const method = String(form?.get("method") || "Bank transfer");
  const reference = String(form?.get("reference") || "");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a proof of payment." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Use a file under 8MB." }, { status: 400 });
  const result = await submitPortalProof(identity, params.projectId, {
    amount,
    method,
    reference,
    file: { buffer: Buffer.from(await file.arrayBuffer()), filename: file.name, contentType: file.type || "application/octet-stream" },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
