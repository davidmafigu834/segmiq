import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

const schema = z.object({
  plan: z.enum(["starter", "professional", "business"]),
  billing_period: z.enum(["monthly", "annual"]),
  payment_status: z.enum(["paid", "unpaid", "overdue"]).optional(),
  next_payment_date: z.string().nullable().optional(),
  payment_notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan or billing period" }, { status: 400 });
  }

  const { plan, billing_period, payment_status, next_payment_date, payment_notes } = parsed.data;
  const supabase = createAdminClient();

  const update: Record<string, unknown> = {
    plan,
    billing_period,
    updated_at: new Date().toISOString(),
  };
  if (payment_status !== undefined) update.payment_status = payment_status;
  if (next_payment_date !== undefined) update.next_payment_date = next_payment_date;
  if (payment_notes !== undefined) update.payment_notes = payment_notes;

  const { error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", params.clientId);

  if (error) {
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }

  await supabase.from("plan_changes").insert({
    client_id: params.clientId,
    changed_by: g.session.userId,
    new_plan: plan,
    new_billing_period: billing_period,
    changed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
