import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CHUNK_SIZE = 100;

/** Fetch call logs for many leads without exceeding PostgREST URL / IN-list limits. */
export async function fetchCallLogsByLeadIds<
  T extends { lead_id: string; created_at: string } = { lead_id: string; created_at: string },
>(
  supabase: SupabaseClient,
  leadIds: string[],
  select = "lead_id, created_at",
  chunkSize = DEFAULT_CHUNK_SIZE
): Promise<T[]> {
  if (leadIds.length === 0) return [];

  const rows: T[] = [];

  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("call_logs").select(select).in("lead_id", chunk);

    if (error) {
      console.error("[call-logs] chunk failed:", error.message);
      continue;
    }

    rows.push(...((data ?? []) as T[]));
  }

  return rows;
}
