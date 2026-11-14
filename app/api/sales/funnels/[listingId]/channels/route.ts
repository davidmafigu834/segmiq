import { NextResponse } from "next/server";
import { z } from "zod";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { funnelActor } from "@/lib/real-estate/funnels/session";
import { addChannelLink } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

const schema = z.object({ label: z.string().max(60) });

export async function POST(req: Request, { params }: { params: { listingId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden" }, { status: origin.status });
  const actor = await funnelActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.listingId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name the channel, for example LinkedIn." }, { status: 400 });
  const result = await addChannelLink(createAdminClient(), actor, params.listingId, parsed.data.label);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ channel: result.channel }, { status: 201 });
}
