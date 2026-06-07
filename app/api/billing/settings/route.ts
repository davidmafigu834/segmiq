import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "bank_name",
  "bank_account_name",
  "bank_account_number",
  "bank_branch",
  "swift",
  "mobile_money_number",
  "mobile_money_name",
  "payment_instructions",
] as const;

export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of FIELDS) {
    if (field in body) {
      const value = body[field];
      update[field] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("billing_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("billing_settings").update(update).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("billing_settings").insert(update);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
