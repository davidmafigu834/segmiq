import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesMatch } from "@/lib/leads/phone-match";

export type OpenLeadMatch = {
  id: string;
  assigned_to_id: string | null;
  contact_id: string | null;
  form_data: Record<string, unknown> | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
  magic_token: string | null;
  status: string;
};

export async function findOpenLeadByPhone(opts: {
  supabase: SupabaseClient;
  clientId: string;
  phoneDigits: string;
}): Promise<OpenLeadMatch | null> {
  const { supabase, clientId, phoneDigits } = opts;
  if (!phoneDigits) return null;

  const { data: openLeads } = await supabase
    .from("leads")
    .select(
      "id, assigned_to_id, name, phone, status, contact_id, form_data, email, budget, project_type, timeline, magic_token"
    )
    .eq("client_id", clientId)
    .or("is_archived.is.null,is_archived.eq.false")
    .not("status", "in", '("WON","LOST","NOT_QUALIFIED")')
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    (openLeads ?? []).find((lead) => phonesMatch(lead.phone as string | null, phoneDigits)) ??
    null
  ) as OpenLeadMatch | null;
}
