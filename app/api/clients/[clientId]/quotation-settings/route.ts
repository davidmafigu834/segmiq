import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { stripCostFromUnknown } from "@/lib/quotations/governance";

const TEXT_KEYS = [
  "company_address",
  "company_email",
  "company_website",
  "company_phone",
  "default_terms",
  "footer_note",
  "default_payment_terms",
  "default_currency",
  "price_edit_policy",
  "margin_visibility",
  "brand_footer",
  "bank_details",
  "tax_registration",
  "legal_registration",
] as const;

const NUM_KEYS = [
  "default_tax_rate",
  "default_validity_days",
  "max_discount_percent",
  "min_margin_percent",
  "margin_warning_percent",
  "approval_value_threshold",
  "secure_link_ttl_days",
] as const;

const BOOL_KEYS = [
  "require_approval_above_discount",
  "salesperson_can_see_margin",
  "salesperson_can_see_cost",
  "allow_quotation_discount",
  "salesperson_can_create_custom_item",
  "salesperson_can_create_package",
  "require_approval_for_custom_items",
  "customer_allow_accept",
  "customer_allow_request_changes",
  "customer_allow_ask_question",
  "customer_allow_decline",
  "customer_allow_option_selection",
  "require_acceptance_name",
  "require_acceptance_checkbox",
] as const;

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const settings = await ensureQuotationSettings(supabase, params.clientId);
  const isManager = session.role === "CLIENT_MANAGER" || session.role === "SUPER_ADMIN";
  return NextResponse.json({
    settings: isManager ? settings : stripCostFromUnknown(settings, false),
  });
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

  const body = (await req.json()) as Record<string, unknown>;
  const supabase = createAdminClient();
  await ensureQuotationSettings(supabase, params.clientId);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of TEXT_KEYS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  for (const key of NUM_KEYS) {
    if (body[key] !== undefined) {
      updates[key] = body[key] == null || body[key] === "" ? null : Number(body[key]);
    }
  }
  for (const key of BOOL_KEYS) {
    if (body[key] !== undefined) updates[key] = Boolean(body[key]);
  }
  if (body.quote_prefix !== undefined) updates.quote_prefix = String(body.quote_prefix).trim() || "Q";
  if (body.supported_currencies !== undefined) updates.supported_currencies = body.supported_currencies;
  if (body.discount_authority !== undefined) updates.discount_authority = body.discount_authority;

  const { data, error } = await supabase
    .from("quotation_settings")
    .update(updates)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
