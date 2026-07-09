import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { saveTemplateItems, loadTemplateWithItems } from "@/lib/quotations/templates";
import type { QuotationLineItemInput } from "@/types";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("all") === "1";

  const supabase = createAdminClient();
  let query = supabase
    .from("quote_templates")
    .select("*")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit quote templates" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name: string;
    description?: string | null;
    tax_rate?: number;
    other_amount?: number;
    notes?: string | null;
    terms?: string | null;
    valid_for_days?: number;
    items?: QuotationLineItemInput[];
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: template, error } = await supabase
    .from("quote_templates")
    .insert({
      client_id: params.clientId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      tax_rate: Number(body.tax_rate) || 0,
      other_amount: Number(body.other_amount) || 0,
      notes: body.notes ?? null,
      terms: body.terms ?? null,
      valid_for_days: body.valid_for_days ?? 30,
    })
    .select("*")
    .single();

  if (error || !template) {
    return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
  }

  if (body.items?.length) {
    await saveTemplateItems(
      supabase,
      template.id as string,
      body.items,
      Number(body.tax_rate) || 0,
      Number(body.other_amount) || 0
    );
  }

  const full = await loadTemplateWithItems(supabase, template.id as string);
  return NextResponse.json({ template: full }, { status: 201 });
}
