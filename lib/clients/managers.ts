import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientManagerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  notification_prefs?: unknown;
};

/** Active client managers for a client account. */
export async function getActiveClientManagers(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientManagerRow[]> {
  const { data } = await supabase
    .from("users")
    .select("id, name, email, phone, is_active, notification_prefs")
    .eq("client_id", clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? []) as ClientManagerRow[];
}
