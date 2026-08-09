import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  fetchSalesGoalsPayload,
  updateSalesGoal,
} from "@/lib/sales/goals/sales-goals-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const { id } = await ctx.params;
  let body: { targetValue?: number; status?: "ACTIVE" | "CANCELLED" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Ensure ownership before update
  const supabase = createAdminClient();
  const { data: existing, error: lookupErr } = await supabase
    .from("sales_goals")
    .select("id, salesperson_id, client_id, period_start, status")
    .eq("id", id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }
  if (
    existing.client_id !== session!.clientId ||
    existing.salesperson_id !== session!.userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.targetValue != null) {
    const targetValue = Number(body.targetValue);
    if (!(targetValue > 0) || !Number.isFinite(targetValue)) {
      return NextResponse.json(
        { error: "Enter a target greater than zero." },
        { status: 400 }
      );
    }
  }

  try {
    const goal = await updateSalesGoal({
      id,
      clientId: session!.clientId,
      salespersonId: session!.userId,
      targetValue: body.targetValue != null ? Number(body.targetValue) : undefined,
      status: body.status,
    });
    const periodKey = String(existing.period_start).slice(0, 7);
    const data = await fetchSalesGoalsPayload({
      userId: session!.userId,
      clientId: session!.clientId,
      period: periodKey,
    });
    return NextResponse.json({ goal, data });
  } catch (err) {
    console.error("Sales goals PATCH error:", err);
    const message = err instanceof Error ? err.message : "Couldn't save goal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
