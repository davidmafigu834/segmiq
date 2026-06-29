import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensure the single agency_proposal_settings row exists and return it.
 * Creates a default row on first use.
 */
export async function ensureProposalSettings(
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  const { data: existing } = await supabase
    .from("agency_proposal_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as Record<string, unknown>;

  const { data: created } = await supabase
    .from("agency_proposal_settings")
    .insert({ company_name: "Segmiq" })
    .select("*")
    .single();
  return (created ?? { proposal_prefix: "P", next_number: 1 }) as Record<string, unknown>;
}

/**
 * Allocate the next proposal number (e.g. "P0007") and advance the counter.
 * Low-volume read-modify-write — acceptable under the service role.
 */
export async function allocateProposalNumber(supabase: SupabaseClient): Promise<string> {
  const settings = await ensureProposalSettings(supabase);
  const prefix = (settings.proposal_prefix as string | null)?.trim() || "P";
  const next = Number(settings.next_number ?? 1) || 1;

  await supabase
    .from("agency_proposal_settings")
    .update({ next_number: next + 1, updated_at: new Date().toISOString() })
    .eq("id", settings.id as string);

  return `${prefix}${String(next).padStart(4, "0")}`;
}
