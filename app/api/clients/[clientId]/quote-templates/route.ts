import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { saveTemplateItems, loadTemplateWithItems } from "@/lib/quotations/templates";
import {
  ensureBuiltinQuoteTemplates,
  mergePickerTemplates,
  virtualBuiltinTemplates,
} from "@/lib/quotations/layouts/ensure-builtin";
import type { QuotationLineItemInput } from "@/types";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("all") === "1";

  const supabase = createAdminClient();
  await ensureBuiltinQuoteTemplates(supabase, params.clientId).catch(() => null);

  let query = supabase
    .from("quote_templates")
    .select("*")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({
      templates: virtualBuiltinTemplates().map((t) => ({ ...t, client_id: params.clientId })),
    });
  }
  const merged = mergePickerTemplates((data ?? []) as Array<Record<string, unknown>>, true);
  return NextResponse.json({
    templates: merged.map((t) => {
      const row = (data ?? []).find((r) => String((r as { id: string }).id) === t.id);
      return { ...(row ?? {}), ...t };
    }),
  });
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
    name?: string;
    description?: string | null;
    tax_rate?: number;
    other_amount?: number;
    notes?: string | null;
    terms?: string | null;
    valid_for_days?: number;
    items?: QuotationLineItemInput[];
    duplicate_from?: string;
    presentation?: Record<string, unknown>;
  };

  const supabase = createAdminClient();

  if (body.duplicate_from) {
    const source = await loadTemplateWithItems(supabase, body.duplicate_from);
    if (!source || source.client_id !== params.clientId) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const copyName =
      body.name?.trim() ||
      `${String(source.name ?? "Template")} — copy`;
    const { data: template, error } = await supabase
      .from("quote_templates")
      .insert({
        client_id: params.clientId,
        name: copyName,
        description: (source.description as string | null) ?? null,
        tax_rate: Number(source.tax_rate) || 0,
        other_amount: Number(source.other_amount) || 0,
        notes: (source.notes as string | null) ?? null,
        terms: (source.terms as string | null) ?? null,
        valid_for_days: Number(source.valid_for_days) || 30,
        layout_key: (source.layout_key as string | null) ?? (source.builtin_key as string | null) ?? null,
        category: (source.category as string | null) ?? null,
        presentation: (source.presentation as Record<string, unknown>) ?? {},
        field_schema: source.field_schema ?? [],
        is_builtin: false,
        builtin_key: null,
        source_template_id: source.id,
        layout_version: Number(source.layout_version) || 1,
      })
      .select("*")
      .single();
    if (error || !template) {
      return NextResponse.json({ error: error?.message ?? "Duplicate failed" }, { status: 500 });
    }
    const sourceItems = (source.items as Record<string, unknown>[]) ?? [];
    if (sourceItems.length) {
      await saveTemplateItems(
        supabase,
        template.id as string,
        sourceItems as unknown as QuotationLineItemInput[],
        Number(source.tax_rate) || 0,
        Number(source.other_amount) || 0
      );
    }
    const full = await loadTemplateWithItems(supabase, template.id as string);
    return NextResponse.json({ template: full }, { status: 201 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

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
