import { NextResponse } from "next/server";
import { solarActor, solarError } from "@/lib/sales/solar-workflow/http";
import { completeSalesAssessment, saveSalesAssessment } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

async function write(req: Request, visitId: string, complete: boolean) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const body = await req.json().catch(() => null);
  const result = complete
    ? await completeSalesAssessment(actor, visitId, body)
    : await saveSalesAssessment(actor, visitId, body);
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json(result);
}

export async function PUT(req: Request, { params }: { params: { visitId: string } }) {
  return write(req, params.visitId, false);
}

export async function POST(req: Request, { params }: { params: { visitId: string } }) {
  return write(req, params.visitId, true);
}
