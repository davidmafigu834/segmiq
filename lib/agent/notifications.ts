import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Agent in-app notifications (type AGENT_ALERT). Deep-linking uses lead_id,
 * matching the existing NotificationBell behaviour.
 */
export async function notifyAgentAlert(opts: {
  userId: string;
  message: string;
  leadId?: string | null;
}): Promise<void> {
  try {
    const { error } = await createAdminClient().from("notifications").insert({
      user_id: opts.userId,
      type: "AGENT_ALERT",
      message: opts.message.slice(0, 500),
      read: false,
      lead_id: opts.leadId ?? null,
    });
    if (error) console.error("[agent] notification insert failed", error.message);
  } catch (err) {
    console.error("[agent] notification insert failed", err);
  }
}

/** Notify the conversation owner, or all company managers when unassigned. */
export async function notifyOwnerOrManagers(opts: {
  clientId: string;
  ownerId: string | null;
  leadId: string;
  message: string;
}): Promise<void> {
  const supabase = createAdminClient();
  if (opts.ownerId) {
    await notifyAgentAlert({ userId: opts.ownerId, message: opts.message, leadId: opts.leadId });
    return;
  }
  const { data: managers } = await supabase
    .from("users")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);
  await Promise.all(
    (managers ?? []).map((m) =>
      notifyAgentAlert({ userId: m.id as string, message: opts.message, leadId: opts.leadId })
    )
  );
}
