import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { canManageClientTeam } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSalesGoal,
  fetchSalesGoalsPayload,
  updateSalesGoal,
} from "@/lib/sales/goals/sales-goals-data";
import { parseGoalPeriodKey } from "@/lib/sales/goals/period";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const clientId = session!.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (!canManageClientTeam(session!, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    salespersonId?: string;
    targetValue?: number;
    periodKey?: string;
    currency?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const salespersonId = String(body.salespersonId ?? "");
  const targetValue = Number(body.targetValue);
  if (!salespersonId) {
    return NextResponse.json({ error: "salespersonId required" }, { status: 400 });
  }
  if (!(targetValue > 0) || !Number.isFinite(targetValue)) {
    return NextResponse.json({ error: "Enter a target greater than zero." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: member } = await supabase
    .from("users")
    .select("id, client_id, role")
    .eq("id", salespersonId)
    .maybeSingle();
  if (!member || (member.client_id as string) !== clientId) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  const periodKey = parseGoalPeriodKey(body.periodKey ?? null);

  try {
    const goal = await createSalesGoal({
      clientId,
      salespersonId,
      createdById: session!.userId,
      targetValue,
      periodKey,
      currency: body.currency || "USD",
    });
    const data = await fetchSalesGoalsPayload({
      userId: salespersonId,
      clientId,
      period: periodKey,
    });
    return NextResponse.json({ goal, data }, { status: 201 });
  } catch (err) {
    console.error("[client/team/goals POST]", err);
    const message = err instanceof Error ? err.message : "Couldn't save goal";
    const status = /already have an active goal/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const clientId = session!.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (!canManageClientTeam(session!, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { goalId?: string; targetValue?: number; status?: "ACTIVE" | "CANCELLED" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const goalId = String(body.goalId ?? "");
  if (!goalId) {
    return NextResponse.json({ error: "goalId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("sales_goals")
    .select("id, salesperson_id, client_id, period_start")
    .eq("id", goalId)
    .maybeSingle();
  if (!existing || (existing.client_id as string) !== clientId) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  if (body.targetValue != null) {
    const targetValue = Number(body.targetValue);
    if (!(targetValue > 0) || !Number.isFinite(targetValue)) {
      return NextResponse.json({ error: "Enter a target greater than zero." }, { status: 400 });
    }
  }

  try {
    const goal = await updateSalesGoal({
      id: goalId,
      clientId,
      salespersonId: existing.salesperson_id as string,
      targetValue: body.targetValue != null ? Number(body.targetValue) : undefined,
      status: body.status,
    });
    return NextResponse.json({ goal });
  } catch (err) {
    console.error("[client/team/goals PATCH]", err);
    const message = err instanceof Error ? err.message : "Couldn't save goal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
