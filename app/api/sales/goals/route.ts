import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  createSalesGoal,
  fetchSalesGoalsPayload,
} from "@/lib/sales/goals/sales-goals-data";
import { parseGoalPeriodKey } from "@/lib/sales/goals/period";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const url = new URL(req.url);
  const period = parseGoalPeriodKey(url.searchParams.get("period"));

  try {
    const data = await fetchSalesGoalsPayload({
      userId: session!.userId,
      clientId: session!.clientId,
      period,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales goals GET error:", err);
    const message = err instanceof Error ? err.message : "Failed to load goals";
    // Table missing — guide setup without crashing the app shell
    if (/sales_goals|relation|does not exist/i.test(message)) {
      return NextResponse.json(
        {
          error: "Goals table is not set up yet. Apply migration 086_sales_goals.",
          code: "GOALS_SCHEMA_MISSING",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to load goals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  let body: { targetValue?: number; periodKey?: string; currency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetValue = Number(body.targetValue);
  if (!(targetValue > 0) || !Number.isFinite(targetValue)) {
    return NextResponse.json(
      { error: "Enter a target greater than zero." },
      { status: 400 }
    );
  }

  const periodKey = parseGoalPeriodKey(body.periodKey ?? null);

  try {
    const goal = await createSalesGoal({
      clientId: session!.clientId,
      salespersonId: session!.userId,
      createdById: session!.userId,
      targetValue,
      periodKey,
      currency: body.currency || "USD",
    });
    const data = await fetchSalesGoalsPayload({
      userId: session!.userId,
      clientId: session!.clientId,
      period: periodKey,
    });
    return NextResponse.json({ goal, data }, { status: 201 });
  } catch (err) {
    console.error("Sales goals POST error:", err);
    const message = err instanceof Error ? err.message : "Couldn't save goal";
    const status = /already have an active goal/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
