import { NextResponse } from "next/server";
import { solarActor, solarError } from "@/lib/sales/solar-workflow/http";
import { scheduleSalesSiteVisit } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const body = (await req.json().catch(() => null)) as {
    leadId?: string;
    startAt?: string;
    durationMinutes?: number;
    assignedToId?: string;
    siteAddress?: string | null;
    siteCity?: string | null;
    instructions?: string | null;
    notifyCustomer?: boolean;
  } | null;
  if (!body?.leadId || !body.startAt || !body.assignedToId) {
    return solarError(400, "Date, time, and assigned staff are required.");
  }
  const result = await scheduleSalesSiteVisit(actor, {
    leadId: body.leadId,
    startAt: body.startAt,
    durationMinutes: body.durationMinutes ?? 60,
    assignedToId: body.assignedToId,
    siteAddress: body.siteAddress,
    siteCity: body.siteCity,
    instructions: body.instructions,
    notifyCustomer: body.notifyCustomer,
  });
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json(result);
}
