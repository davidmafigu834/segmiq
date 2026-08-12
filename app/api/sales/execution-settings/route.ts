import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  fetchExecutionSettings,
  upsertExecutionSettings,
} from "@/lib/sales/intelligence/daily-plan-service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  scope: z.enum(["self", "client"]).default("self"),
  dailyProspectTarget: z.number().int().positive().nullable().optional(),
  dailyCallTarget: z.number().int().positive().nullable().optional(),
  dailyFollowupTarget: z.number().int().positive().nullable().optional(),
  dailyQuoteTarget: z.number().int().positive().nullable().optional(),
  dailyAppointmentTarget: z.number().int().positive().nullable().optional(),
});

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;
  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  try {
    const settings = await fetchExecutionSettings({
      clientId: session!.clientId,
      salespersonId: session!.userId,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Execution settings GET error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;
  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = parsed.data;
  // Client baseline only for managers; salespeople edit own override
  if (body.scope === "client" && session!.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await upsertExecutionSettings({
      clientId: session!.clientId,
      salespersonId: body.scope === "client" ? null : session!.userId,
      patch: {
        dailyProspectTarget: body.dailyProspectTarget,
        dailyCallTarget: body.dailyCallTarget,
        dailyFollowupTarget: body.dailyFollowupTarget,
        dailyQuoteTarget: body.dailyQuoteTarget,
        dailyAppointmentTarget: body.dailyAppointmentTarget,
      },
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Execution settings PATCH error:", err);
    const message = err instanceof Error ? err.message : "Failed to save";
    if (/sales_execution_settings|does not exist|relation/i.test(message)) {
      return NextResponse.json(
        { error: "Apply migration 087_sales_execution_intelligence first.", code: "INTELLIGENCE_SCHEMA_MISSING" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
