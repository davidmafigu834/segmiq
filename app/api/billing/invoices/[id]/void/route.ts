import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Cannot void a paid invoice" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "void", updated_at: now })
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
