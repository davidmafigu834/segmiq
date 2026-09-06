import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { listAfterSalesCases } from "@/lib/real-estate/after-sales-service";
import type { AfterSalesStatus } from "@/lib/real-estate/after-sales";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  const status =
    statusParam === "active" || statusParam === "all"
      ? statusParam
      : (statusParam as AfterSalesStatus);

  const scopeOwn = session.role === "SALESPERSON";
  const result = await listAfterSalesCases({
    clientId: params.clientId,
    status,
    scopeOwn,
    actorId: session.userId,
  });

  return NextResponse.json(result);
}
