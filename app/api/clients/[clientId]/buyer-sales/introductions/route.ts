import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { listBuyerIntroductions } from "@/lib/real-estate/buyer-introduction-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const result = await listBuyerIntroductions(params.clientId, {
    id: g.session.userId,
    name: g.session.user?.name ?? "Agent",
    role: g.session.role,
    clientId: g.session.clientId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
