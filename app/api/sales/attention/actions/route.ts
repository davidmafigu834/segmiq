import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  completeAttentionItem,
  dismissAttentionItem,
  getAttentionItem,
  getTodaysFocus,
  resolveSnoozeUntil,
  snoozeAttentionItem,
} from "@/lib/sales/attention";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  itemId: z.string().min(1),
  action: z.enum(["complete", "snooze", "dismiss", "refresh"]),
  snoozePreset: z.enum(["later_today", "tomorrow", "next_business_day", "custom"]).optional(),
  snoozedUntil: z.string().datetime().optional(),
  dismissReason: z
    .enum([
      "ALREADY_HANDLED",
      "WAITING_ON_CUSTOMER",
      "WAITING_ON_STOCK",
      "WAITING_ON_MANAGER",
      "NOT_A_REAL_OPPORTUNITY",
      "DUPLICATE",
      "OTHER",
    ])
    .optional(),
});

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
  const clientId = session!.clientId;
  const userId = session!.userId;

  if (body.action === "refresh") {
    const focus = await getTodaysFocus({ userId, clientId });
    return NextResponse.json({ ok: true, focus });
  }

  const item = await getAttentionItem({ userId, clientId, itemId: body.itemId });
  if (!item) {
    return NextResponse.json({ error: "Focus item not found or already cleared" }, { status: 404 });
  }

  const focus = await getTodaysFocus({ userId, clientId });
  const planDate = focus.planDate;

  try {
    if (body.action === "complete") {
      await completeAttentionItem({ userId, clientId, item, planDate });
    } else if (body.action === "snooze") {
      const until = resolveSnoozeUntil(body.snoozePreset ?? "later_today", {
        customIso: body.snoozedUntil,
      });
      await snoozeAttentionItem({ userId, clientId, item, planDate, snoozedUntil: until });
    } else if (body.action === "dismiss") {
      await dismissAttentionItem({
        userId,
        clientId,
        item,
        planDate,
        reason: body.dismissReason ?? "OTHER",
      });
    }

    const next = await getTodaysFocus({ userId, clientId });
    return NextResponse.json({ ok: true, focus: next });
  } catch (err) {
    console.error("Sales attention action POST error:", err);
    return NextResponse.json({ error: "Failed to update focus item" }, { status: 500 });
  }
}
