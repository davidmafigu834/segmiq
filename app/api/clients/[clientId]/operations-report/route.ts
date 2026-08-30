import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { getRealEstateOperationsReport } from "@/lib/real-estate/operations-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now);
  defaultTo.setDate(now.getDate() + 1);
  defaultTo.setHours(0, 0, 0, 0);

  const report = await getRealEstateOperationsReport(params.clientId, {
    from: from || defaultFrom.toISOString(),
    to: to || defaultTo.toISOString(),
  });
  return NextResponse.json(report);
}
