import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { getAgencySettings } from "@/lib/agency-settings";
import { mutateActionState } from "@/lib/sales/intelligence/daily-plan-service";
import {
  planDateInTimezone,
  resolveSalesTimezone,
} from "@/lib/sales/intelligence/timezone";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idempotencyKey: z.string().min(1),
  actionType: z.string().min(1),
  reasonCode: z.string().min(1),
  sourceEntityType: z.enum(["lead", "quotation", "task", "goal", "none"]).default("lead"),
  sourceEntityId: z.string().uuid().nullable().optional(),
  action: z.enum(["complete", "snooze", "skip", "resolve"]),
  snoozedUntil: z.string().datetime().nullable().optional(),
  skipReason: z.string().max(500).nullable().optional(),
  snoozePreset: z.enum(["later_today", "tomorrow_morning", "custom"]).optional(),
});

function resolveSnoozeUntil(
  preset: "later_today" | "tomorrow_morning" | "custom" | undefined,
  custom: string | null | undefined,
  now: Date
): string {
  if (preset === "custom" && custom) return custom;
  if (preset === "tomorrow_morning") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  // later_today — +3 hours
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

export async function POST(req: Request) {
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  if (body.action === "skip" && !body.skipReason?.trim()) {
    return NextResponse.json({ error: "Skip reason is required" }, { status: 400 });
  }

  const now = new Date();
  const agency = await getAgencySettings();
  const timezone = resolveSalesTimezone(agency.default_timezone);
  const planDate = planDateInTimezone(now, timezone);

  const state =
    body.action === "complete"
      ? "completed"
      : body.action === "snooze"
        ? "snoozed"
        : body.action === "skip"
          ? "skipped"
          : "resolved";

  const snoozedUntil =
    body.action === "snooze"
      ? resolveSnoozeUntil(body.snoozePreset, body.snoozedUntil, now)
      : null;

  try {
    await mutateActionState({
      clientId: session!.clientId,
      salespersonId: session!.userId,
      planDate,
      idempotencyKey: body.idempotencyKey,
      actionType: body.actionType,
      reasonCode: body.reasonCode,
      sourceEntityType: body.sourceEntityType,
      sourceEntityId: body.sourceEntityId ?? null,
      state,
      snoozedUntil,
      skipReason: body.skipReason ?? null,
    });
    return NextResponse.json({ ok: true, state, snoozedUntil });
  } catch (err) {
    console.error("Daily plan action POST error:", err);
    return NextResponse.json({ error: "Failed to update action" }, { status: 500 });
  }
}
