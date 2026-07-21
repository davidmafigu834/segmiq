import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CHUNK_SIZE = 100;

export type CallLogLeadRow = { lead_id: string; created_at: string };

/** Fetch call logs for many leads without exceeding PostgREST URL / IN-list limits. */
export async function fetchCallLogsByLeadIds(
  supabase: SupabaseClient,
  leadIds: string[],
  chunkSize = DEFAULT_CHUNK_SIZE
): Promise<CallLogLeadRow[]> {
  if (leadIds.length === 0) return [];

  const rows: CallLogLeadRow[] = [];

  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("call_logs")
      .select("lead_id, created_at")
      .in("lead_id", chunk);

    if (error) {
      console.error("[call-logs] chunk failed:", error.message);
      continue;
    }

    rows.push(...((data ?? []) as CallLogLeadRow[]));
  }

  return rows;
}
