import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPublicMagicLeadPayload, PUBLIC_MAGIC_LEAD_SELECT } from "@/lib/leads/public-magic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const supabase = createAdminClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select(PUBLIC_MAGIC_LEAD_SELECT)
    .eq("magic_token", token)
    .maybeSingle();
  if (error || !lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const exp = lead.magic_token_expires_at as string | null;
  if (exp && new Date(exp) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json({ lead: buildPublicMagicLeadPayload(lead as Record<string, unknown>) });
}
