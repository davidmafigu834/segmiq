import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_LEARNING_CONFIG,
  type LearningConfig,
  type LearningSettings,
} from "./types";
import { isLearningGloballyEnabled, mergeLearningConfig } from "./policy";

type SettingsRow = Record<string, unknown>;

function rowToLearning(clientId: string, row: SettingsRow | null): LearningSettings {
  return {
    clientId,
    enabled: Boolean(row?.learning_enabled),
    suggestReplies: Boolean(row?.suggest_replies),
    config: mergeLearningConfig(row?.learning_config),
  };
}

export async function getLearningSettings(clientId: string): Promise<LearningSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_company_settings")
    .select("learning_enabled, suggest_replies, learning_config")
    .eq("client_id", clientId)
    .maybeSingle();
  return rowToLearning(clientId, data as SettingsRow | null);
}

export type LearningSettingsPatch = Partial<Omit<LearningSettings, "clientId" | "config">> & {
  config?: Partial<LearningConfig>;
};

export async function updateLearningSettings(
  clientId: string,
  patch: LearningSettingsPatch
): Promise<LearningSettings> {
  const current = await getLearningSettings(clientId);
  const nextConfig: LearningConfig = { ...current.config, ...(patch.config ?? {}) };
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    client_id: clientId,
    updated_at: new Date().toISOString(),
  };
  if (patch.enabled !== undefined) update.learning_enabled = patch.enabled;
  if (patch.suggestReplies !== undefined) update.suggest_replies = patch.suggestReplies;
  if (patch.config !== undefined) update.learning_config = nextConfig;
  const { data, error } = await supabase
    .from("agent_company_settings")
    .upsert(update, { onConflict: "client_id" })
    .select("learning_enabled, suggest_replies, learning_config")
    .single();
  if (error) throw new Error(`Failed to update learning settings: ${error.message}`);
  return rowToLearning(clientId, data as SettingsRow);
}

export { isLearningGloballyEnabled, DEFAULT_LEARNING_CONFIG };
