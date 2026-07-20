import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingSettings = {
  client_id: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  max_messages_per_contact_per_week: number;
  approval_threshold: number;
  duplicate_campaign_days: number;
  auto_pause_opt_out_rate: number;
  estimated_cost_per_message_usd: number | null;
};

export const DEFAULT_MARKETING_SETTINGS: Omit<MarketingSettings, "client_id"> = {
  quiet_hours_start: "20:00:00",
  quiet_hours_end: "08:00:00",
  timezone: "Africa/Harare",
  max_messages_per_contact_per_week: 1,
  approval_threshold: 100,
  duplicate_campaign_days: 7,
  auto_pause_opt_out_rate: 0.05,
  estimated_cost_per_message_usd: null,
};

export async function getMarketingSettings(clientId: string): Promise<MarketingSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_marketing_settings")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) {
    return { client_id: clientId, ...DEFAULT_MARKETING_SETTINGS };
  }

  return data as MarketingSettings;
}

export async function upsertMarketingSettings(
  clientId: string,
  patch: Partial<Omit<MarketingSettings, "client_id">>
): Promise<MarketingSettings> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("client_marketing_settings")
    .upsert(
      {
        client_id: clientId,
        updated_at: now,
        ...DEFAULT_MARKETING_SETTINGS,
        ...patch,
      },
      { onConflict: "client_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as MarketingSettings;
}
