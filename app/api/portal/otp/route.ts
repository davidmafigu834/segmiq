import { NextResponse } from "next/server";
import { z } from "zod";
import { portalOriginOk } from "@/lib/portal/auth";
import { startPortalOtp, verifyPortalOtp } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["start", "verify"]),
  inviteToken: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  code: z.string().max(12).optional(),
});

export async function POST(req: Request) {
  if (!portalOriginOk(req)) return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  if (body.data.action === "start") {
    const result = await startPortalOtp({ inviteToken: body.data.inviteToken, phone: body.data.phone });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 429 });
    return NextResponse.json(result);
  }
  const result = await verifyPortalOtp({ inviteToken: body.data.inviteToken, phone: body.data.phone, code: body.data.code || "" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
