import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from "./registry";
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

export async function ensureBuiltinQuoteTemplates(
  supabase: SupabaseClient,
  clientId: string
): Promise<Array<Record<string, unknown>>> {
  const ensured: Array<Record<string, unknown>> = [];
  for (const def of BUILTIN_TEMPLATES) {
    const { data: existing } = await supabase
      .from("quote_templates")
      .select("*")
      .eq("client_id", clientId)
      .eq("builtin_key", def.key)
      .maybeSingle();
    if (existing) {
      ensured.push(existing);
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
        tax_rate: 0,
        other_amount: 0,
        valid_for_days: 30,
      })
      .select("*")
      .single();
    if (!error && created) ensured.push(created);
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
