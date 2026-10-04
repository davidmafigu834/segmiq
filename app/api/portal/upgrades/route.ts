import { NextResponse } from "next/server";
import { z } from "zod";
import { portalOriginOk } from "@/lib/portal/auth";
import { createPortalUpgrade, getPortalIdentity } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  intent: z.string().max(160),
  detail: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  if (!portalOriginOk(req)) return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  const identity = await getPortalIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the request and try again." }, { status: 400 });
  const result = await createPortalUpgrade(identity, body.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
