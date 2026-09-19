import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/types";

export async function notifySocialInbox(input: {
  userId: string;
  clientId: string;
  message: string;
  conversationId?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("notifications").insert({
      user_id: input.userId,
      client_id: input.clientId,
      type: "SOCIAL_INBOX" as NotificationType,
      message: input.message.slice(0, 280),
      read: false,
      lead_id: null,
    });
  } catch (err) {
    console.warn("[social-inbox] notify failed", err);
  }
}
