import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS = ["starter", "growth", "scale"];
const CYCLES = ["monthly", "annual"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { plan?: unknown; billing_cycle?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.plan !== undefined) {
    if (typeof body.plan !== "string" || !PLANS.includes(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    update.plan = body.plan;
  }
  if (body.billing_cycle !== undefined) {
    if (typeof body.billing_cycle !== "string" || !CYCLES.includes(body.billing_cycle)) {
      return NextResponse.json({ error: "Invalid billing_cycle" }, { status: 400 });
    }
    update.billing_cycle = body.billing_cycle;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    update.amount = amount;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("subscriptions").update(update).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
