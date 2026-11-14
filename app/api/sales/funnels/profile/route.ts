import { NextResponse } from "next/server";
import { z } from "zod";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { funnelActor } from "@/lib/real-estate/funnels/session";
import { handleTaken, saveAgentProfile } from "@/lib/real-estate/funnels/service";
import { handleProblem, normaliseHandle } from "@/lib/real-estate/funnels/policy";

export const dynamic = "force-dynamic";

const schema = z.object({
  handle: z.string().max(60),
  whatsapp: z.string().max(40),
  line: z.string().max(400),
});

/** Live availability check for the link name field. */
export async function GET(req: Request) {
  const actor = await funnelActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const handle = normaliseHandle(new URL(req.url).searchParams.get("handle"));
  const problem = handleProblem(handle);
  if (problem) return NextResponse.json({ handle, available: false, reason: problem });
  const taken = await handleTaken(createAdminClient(), actor.clientId!, actor.userId, handle);
  return NextResponse.json({ handle, available: !taken, reason: taken ? "Another agent at your agency has this name." : null });
}

export async function PUT(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden" }, { status: origin.status });
  const actor = await funnelActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again" }, { status: 400 });
  const result = await saveAgentProfile(createAdminClient(), actor, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code, field: "field" in result ? result.field : undefined }, { status: result.status });
  return NextResponse.json({ profile: result.profile });
}
