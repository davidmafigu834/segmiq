import { NextResponse } from "next/server";
import { z } from "zod";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { funnelActor } from "@/lib/real-estate/funnels/session";
import { ensureAgentLink } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

/** Creates the agent's main link for a property if it does not exist yet. */
export async function POST(req: Request, { params }: { params: { listingId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden" }, { status: origin.status });
  const actor = await funnelActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.listingId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await ensureAgentLink(createAdminClient(), actor, params.listingId);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ slug: result.slug });
}
