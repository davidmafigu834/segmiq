import { createAdminClient } from "@/lib/supabase/admin";
import { recordWhatsAppConnectionEvent } from "./connections";

const NOTIFIED_EVENT_TYPE = "RECONNECT_REQUIRED_NOTIFIED";
const THROTTLE_HOURS = 6;

/**
 * A flapping connection can reach RECONNECT_REQUIRED repeatedly. Administrators
 * only need to be told once per incident window, so an alert raised recently
 * suppresses the next one.
 */
async function recentlyNotified(connectionId: string): Promise<boolean> {
  const since = new Date(Date.now() - THROTTLE_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await createAdminClient()
    .from("whatsapp_connection_events")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .eq("event_type", NOTIFIED_EVENT_TYPE)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

/**
 * Tells the company's managers that the business WhatsApp number needs to be
 * reconnected. Salespeople are deliberately excluded: they cannot manage the
 * connection and already see a reconnection notice in the Sales Hub.
 */
export async function notifyWhatsAppReconnectRequired(input: {
  connectionId: string;
  clientId: string;
}): Promise<void> {
  if (await recentlyNotified(input.connectionId)) return;

  const supabase = createAdminClient();
  const { data: managers } = await supabase
    .from("users")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);

  if (!managers?.length) return;

  const { error } = await supabase.from("notifications").insert(
    managers.map((manager) => ({
      user_id: manager.id as string,
      client_id: input.clientId,
      type: "WHATSAPP_CONNECTION_ALERT",
      message: "WhatsApp reconnection required — the business WhatsApp connection needs attention.",
      read: false,
      lead_id: null,
    }))
  );
  if (error) {
    console.error("[whatsapp] reconnect alert insert failed", error.message);
    return;
  }

  await recordWhatsAppConnectionEvent({
    connectionId: input.connectionId,
    clientId: input.clientId,
    eventType: NOTIFIED_EVENT_TYPE,
    safeDetails: { recipients: managers.length },
  });
}
