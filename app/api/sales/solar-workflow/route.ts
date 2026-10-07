import { NextResponse } from "next/server";
import { isSalesWorkflowPreset, isSolarSalesStage } from "@/lib/sales/solar-workflow";
import { solarActor, solarError } from "@/lib/sales/solar-workflow/http";
import { applySolarSalesTransition, loadSolarSalesBoard, setSalesWorkflowPreset } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const url = new URL(req.url);
  const valueMin = url.searchParams.get("valueMin");
  const valueMax = url.searchParams.get("valueMax");
  const result = await loadSolarSalesBoard(actor, {
    ownerId: url.searchParams.get("ownerId"),
    stage: url.searchParams.get("stage"),
    source: url.searchParams.get("source"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    valueMin: valueMin ? Number(valueMin) : null,
    valueMax: valueMax ? Number(valueMax) : null,
    mine: actor.role === "SALESPERSON",
  });
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json(result.data);
}

export async function PUT(req: Request) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const body = (await req.json().catch(() => null)) as { preset?: string } | null;
  if (!isSalesWorkflowPreset(body?.preset)) return solarError(400, "Choose General Trades or Solar Installation.");
  const result = await setSalesWorkflowPreset(actor, body.preset);
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json({ preset: result.preset });
}

export async function POST(req: Request) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const body = (await req.json().catch(() => null)) as { leadId?: string; target?: string } | null;
  if (!body?.leadId || !isSolarSalesStage(body.target)) return solarError(400, "Choose a valid stage.");
  const result = await applySolarSalesTransition(actor, body.leadId, body.target);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        action: "action" in result ? result.action : "none",
        dealId: "dealId" in result ? result.dealId : null,
      },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}
