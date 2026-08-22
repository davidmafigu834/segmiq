import type { SupabaseClient } from "@supabase/supabase-js";
import { saveTemplateItems } from "@/lib/quotations/templates";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from "./registry";
import {
  SOLAR_BUILTIN_PAYMENT_LABEL,
  SOLAR_BUILTIN_STARTER_ITEMS,
  SOLAR_BUILTIN_TERMS,
  SOLAR_BUILTIN_WARRANTY,
} from "./builtin-starter";
import { RESIDENTIAL_PREMIUM_SOLAR_KEY } from "./types";

export const BUILTIN_TEMPLATE_ID_PREFIX = "builtin:";

export function virtualBuiltinId(key: string): string {
  return `${BUILTIN_TEMPLATE_ID_PREFIX}${key}`;
}

export function parseVirtualBuiltinId(id: string | null | undefined): string | null {
  if (!id?.startsWith(BUILTIN_TEMPLATE_ID_PREFIX)) return null;
  return id.slice(BUILTIN_TEMPLATE_ID_PREFIX.length) || null;
}

export type PickerTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  layout_key: string | null;
  is_builtin: boolean;
  builtin_key: string | null;
  thumbnail: string | null;
  is_active: boolean;
  recommended?: boolean;
};

async function populateSolarBuiltin(
  supabase: SupabaseClient,
  templateId: string,
  taxRate: number
) {
  await supabase
    .from("quote_templates")
    .update({
      tax_rate: taxRate,
      terms: SOLAR_BUILTIN_TERMS,
      payment_terms_label: SOLAR_BUILTIN_PAYMENT_LABEL,
      warranty_terms: SOLAR_BUILTIN_WARRANTY,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  await saveTemplateItems(supabase, templateId, SOLAR_BUILTIN_STARTER_ITEMS, taxRate, 0);
}

export async function ensureBuiltinQuoteTemplates(
  supabase: SupabaseClient,
  clientId: string
): Promise<Array<Record<string, unknown>>> {
  const settings = await ensureQuotationSettings(supabase, clientId).catch(() => null);
  const taxRate = Number(settings?.default_tax_rate) || 0;
  const ensured: Array<Record<string, unknown>> = [];
  for (const def of BUILTIN_TEMPLATES) {
    const { data: existing } = await supabase
      .from("quote_templates")
      .select("*")
      .eq("client_id", clientId)
      .eq("builtin_key", def.key)
      .maybeSingle();
    if (existing) {
      const { count } = await supabase
        .from("quote_template_line_items")
        .select("id", { count: "exact", head: true })
        .eq("template_id", existing.id as string);
      if (!count && def.key === RESIDENTIAL_PREMIUM_SOLAR_KEY) {
        await populateSolarBuiltin(supabase, existing.id as string, taxRate);
      }
      const full = await supabase.from("quote_templates").select("*").eq("id", existing.id as string).maybeSingle();
      ensured.push(full.data ?? existing);
      continue;
    }
    const { data: created, error } = await supabase
      .from("quote_templates")
      .insert({
        client_id: clientId,
        name: def.name,
        description: def.longDescription,
        layout_key: def.key,
        category: def.category,
        presentation: def.defaultPresentation,
        field_schema: def.fieldSchema,
        is_builtin: true,
        builtin_key: def.key,
        layout_version: def.layoutVersion,
        is_active: true,
        tax_rate: taxRate,
        other_amount: 0,
        valid_for_days: 30,
        terms: SOLAR_BUILTIN_TERMS,
        payment_terms_label: SOLAR_BUILTIN_PAYMENT_LABEL,
        warranty_terms: SOLAR_BUILTIN_WARRANTY,
      })
      .select("*")
      .single();
    if (!error && created) {
      if (def.key === RESIDENTIAL_PREMIUM_SOLAR_KEY) {
        await saveTemplateItems(supabase, created.id as string, SOLAR_BUILTIN_STARTER_ITEMS, taxRate, 0);
      }
      ensured.push(created);
    }
  }
  return ensured;
}

export function virtualBuiltinTemplates(): PickerTemplate[] {
  return BUILTIN_TEMPLATES.map((def) => ({
    id: virtualBuiltinId(def.key),
    name: def.name,
    description: def.description,
    category: def.category,
    layout_key: def.key,
    is_builtin: true,
    builtin_key: def.key,
    thumbnail: def.thumbnailSrc,
    is_active: true,
  }));
}

export function toPickerTemplate(row: Record<string, unknown>): PickerTemplate {
  const builtinKey = typeof row.builtin_key === "string" ? row.builtin_key : null;
  const layoutKey =
    (typeof row.layout_key === "string" && row.layout_key) ||
    builtinKey ||
    null;
  const builtin = getBuiltinTemplate(layoutKey);
  return {
    id: String(row.id),
    name: String(row.name ?? builtin?.name ?? "Template"),
    description: (row.description as string | null) ?? builtin?.description ?? null,
    category: (row.category as string | null) ?? builtin?.category ?? null,
    layout_key: layoutKey,
    is_builtin: Boolean(row.is_builtin) || Boolean(builtinKey),
    builtin_key: builtinKey,
    thumbnail: builtin?.thumbnailSrc ?? null,
    is_active: row.is_active !== false,
  };
}

export function mergePickerTemplates(
  rows: Array<Record<string, unknown>>,
  includeVirtualFallback: boolean
): PickerTemplate[] {
  const mapped = rows.map(toPickerTemplate);
  const hasSolar = mapped.some(
    (t) => t.layout_key === RESIDENTIAL_PREMIUM_SOLAR_KEY || t.builtin_key === RESIDENTIAL_PREMIUM_SOLAR_KEY
  );
  if (!hasSolar && includeVirtualFallback) {
    return [...virtualBuiltinTemplates(), ...mapped];
  }
  return mapped;
}
