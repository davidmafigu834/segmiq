import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensure a quotation_settings row exists for the client and return it.
 * Creates a default row on first use.
 */
export async function ensureQuotationSettings(
  supabase: SupabaseClient,
  clientId: string
): Promise<Record<string, unknown>> {
  const { data: existing } = await supabase
    .from("quotation_settings")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return existing as Record<string, unknown>;

  const { data: created } = await supabase
    .from("quotation_settings")
    .insert({ client_id: clientId })
    .select("*")
    .single();
  return (created ?? { client_id: clientId, quote_prefix: "Q", next_number: 1 }) as Record<
    string,
    unknown
  >;
}

/**
 * Allocate the next quote number for a client (e.g. "Q0007") and advance the
 * counter. Low-volume read-modify-write — acceptable under the service role.
 */
export async function allocateQuoteNumber(
  supabase: SupabaseClient,
  clientId: string
): Promise<string> {
  const settings = await ensureQuotationSettings(supabase, clientId);
  const prefix = (settings.quote_prefix as string | null)?.trim() || "Q";
  const next = Number(settings.next_number ?? 1) || 1;

  await supabase
    .from("quotation_settings")
    .update({ next_number: next + 1, updated_at: new Date().toISOString() })
    .eq("client_id", clientId);

  return `${prefix}${String(next).padStart(4, "0")}`;
}
