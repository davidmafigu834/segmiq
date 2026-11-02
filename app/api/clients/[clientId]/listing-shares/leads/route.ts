import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { attributedLeads } from "@/lib/real-estate/agent-listing-pages/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  const shareId = new URL(req.url).searchParams.get("shareId");
  if (shareId && !/^[0-9a-f-]{36}$/i.test(shareId)) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  const result = await attributedLeads(
    createAdminClient(),
    { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, alsoSells: guard.session.alsoSells },
    params.clientId,
    shareId
  );
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
