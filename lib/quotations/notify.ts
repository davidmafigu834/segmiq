import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyQuotationAlert(opts: {
  userId: string;
  leadId?: string | null;
  message: string;
}): Promise<void> {
  if (!opts.userId) return;
  try {
    await createAdminClient().from("notifications").insert({
      user_id: opts.userId,
      type: "QUOTATION_ALERT",
      message: opts.message,
      read: false,
      lead_id: opts.leadId || null,
    });
  } catch (err) {
    console.error("[quotation notify]", err);
  }
}

export async function notifyClientManagers(opts: {
  clientId: string;
  leadId?: string | null;
  message: string;
  excludeUserId?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("client_id", opts.clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);
    for (const u of data ?? []) {
      if (opts.excludeUserId && u.id === opts.excludeUserId) continue;
      await notifyQuotationAlert({
        userId: u.id as string,
        leadId: opts.leadId,
        message: opts.message,
      });
    }
  } catch (err) {
    console.error("[quotation notify managers]", err);
  }
}
