import { NextResponse } from "next/server";
import { solarActor, solarError } from "@/lib/sales/solar-workflow/http";
import { focusSolarOpportunity, solarLeadSnapshot } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const leadId = new URL(req.url).searchParams.get("leadId") ?? "";
  if (!leadId) return solarError(400, "A lead is required.");
  const result = await solarLeadSnapshot(actor, leadId);
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json({ card: result.data });
}

export async function POST(req: Request) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const body = (await req.json().catch(() => null)) as { leadId?: string; dealId?: string } | null;
  if (!body?.leadId || !body.dealId) return solarError(400, "Choose an opportunity.");
  const result = await focusSolarOpportunity(actor, body.leadId, body.dealId);
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json({ dealId: result.dealId });
}
