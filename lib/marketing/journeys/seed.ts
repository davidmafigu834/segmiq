import { createAdminClient } from "@/lib/supabase/admin";
import { PREDEFINED_JOURNEYS } from "./templates";
import { EMPTY_JOURNEY_STATS } from "./types";

export async function seedJourneysForClient(clientId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("marketing_journeys")
    .select("template_key")
    .eq("client_id", clientId)
    .eq("is_predefined", true);

  const existingKeys = new Set((existing ?? []).map((r) => r.template_key as string));

  const toInsert = PREDEFINED_JOURNEYS.filter((j) => !existingKeys.has(j.template_key)).map(
    (j) => ({
      client_id: clientId,
      name: j.name,
      description: j.description,
      template_key: j.template_key,
      trigger_type: j.trigger_type,
      trigger_config: j.trigger_config,
      steps: j.steps,
      is_predefined: true,
      is_active: false,
      stats: EMPTY_JOURNEY_STATS,
    })
  );

  if (toInsert.length === 0) return;

  const { error } = await supabase.from("marketing_journeys").insert(toInsert);
  if (error) {
    console.error("[journeys] seed failed for client", clientId, error);
  }
}

export async function seedAllClientJourneys(): Promise<void> {
  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false);

  for (const client of clients ?? []) {
    try {
      await seedJourneysForClient(client.id as string);
    } catch (err) {
      console.error("[journeys] seedAll failed for", client.id, err);
    }
  }
}
