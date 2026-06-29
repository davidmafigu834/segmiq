import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import { ensureProposalSettings } from "@/lib/proposals/proposal-number";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const settings = await ensureProposalSettings(supabase);
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const settings = await ensureProposalSettings(supabase);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const allowed = [
    "company_name",
    "company_address",
    "company_email",
    "company_phone",
    "company_website",
    "logo_url",
    "brand_color",
    "default_terms",
    "footer_note",
    "proposal_prefix",
    "default_tax_rate",
    "default_validity_days",
  ] as const;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("agency_proposal_settings")
    .update(updates)
    .eq("id", settings.id as string)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
