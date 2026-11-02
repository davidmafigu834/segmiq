import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShareLink } from "@/lib/real-estate/agent-listing-pages/service";
import type { ShareActor } from "@/lib/real-estate/agent-listing-pages/policy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string; shareId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  if (!/^[0-9a-f-]{36}$/i.test(params.shareId)) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  const actor: ShareActor = { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, alsoSells: guard.session.alsoSells };
  const result = await getShareLink(createAdminClient(), actor, params.clientId, params.shareId);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
