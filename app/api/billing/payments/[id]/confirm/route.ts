import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyPayment } from "@/lib/billing/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const userId = guard.session.userId;

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status === "rejected") {
    return NextResponse.json({ error: "Payment was already rejected" }, { status: 400 });
  }

  if (payment.status !== "confirmed") {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("payments")
      .update({ status: "confirmed", confirmed_by: userId, confirmed_at: now, updated_at: now })
      .eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const result = await applyPayment(params.id);
  return NextResponse.json({ ok: true, ...result });
}
