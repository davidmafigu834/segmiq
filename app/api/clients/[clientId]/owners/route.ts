import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { listOwnerPortfolio, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor: AcquisitionActor = {
    id: g.session.userId,
    name: g.session.user?.name ?? "Agent",
    role: g.session.role,
    clientId: g.session.clientId,
  };
  const url = new URL(req.url);
  const result = await listOwnerPortfolio(params.clientId, actor, url.searchParams.get("contactId"));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
