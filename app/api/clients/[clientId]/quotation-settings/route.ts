import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const settings = await ensureQuotationSettings(supabase, params.clientId);
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit quotation settings" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<{
    company_address: string | null;
    company_email: string | null;
    company_website: string | null;
    company_phone: string | null;
    default_terms: string | null;
    footer_note: string | null;
    quote_prefix: string;
    default_tax_rate: number;
  }>;

  const supabase = createAdminClient();
  await ensureQuotationSettings(supabase, params.clientId);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "company_address",
    "company_email",
    "company_website",
    "company_phone",
    "default_terms",
    "footer_note",
  ] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.quote_prefix !== undefined) updates.quote_prefix = body.quote_prefix.trim() || "Q";
  if (body.default_tax_rate !== undefined) updates.default_tax_rate = Number(body.default_tax_rate) || 0;

  const { data, error } = await supabase
    .from("quotation_settings")
    .update(updates)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
