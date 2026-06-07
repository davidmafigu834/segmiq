import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The `clients` table has no contact-email column, so billing notifications go
 * to the client's active CLIENT_MANAGER user(s), earliest-created first.
 */
export async function getClientNotificationEmails(clientId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("email, created_at")
    .eq("client_id", clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .map((u) => (u.email as string | null)?.trim())
    .filter((e): e is string => Boolean(e));
}
