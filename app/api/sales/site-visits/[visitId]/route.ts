import { NextResponse } from "next/server";
import { solarActor, solarError } from "@/lib/sales/solar-workflow/http";
import { loadSalesSiteVisit } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { visitId: string } }) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const result = await loadSalesSiteVisit(actor, params.visitId);
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json(result.data);
}
