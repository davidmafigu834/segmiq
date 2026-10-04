import { NextResponse } from "next/server";
import { getPortalIdentity, portalDocumentUrl } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { documentId: string } }) {
  const identity = await getPortalIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const url = await portalDocumentUrl(identity.clientId, identity.contactId, params.documentId);
  if (!url) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.redirect(url);
}
