import { createAdminClient } from "@/lib/supabase/admin";
import { now } from "@/lib/clock";
import { upsertContactPrefs } from "@/lib/marketing/consent";

export async function persistDoNotContact(opts: {
  clientId: string;
  contactId: string;
  leadId?: string | null;
  reason: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const at = now().toISOString();
  await supabase
    .from("contacts")
    .update({
      do_not_contact: true,
      do_not_contact_at: at,
      do_not_contact_reason: opts.reason.slice(0, 200),
      updated_at: at,
    })
    .eq("id", opts.contactId)
    .eq("client_id", opts.clientId);

  try {
    await upsertContactPrefs(opts.contactId, opts.clientId, {
      whatsapp_marketing: "opted_out",
      suppressed: true,
      opt_out_at: at,
      opt_out_reason: opts.reason.slice(0, 200),
    });
  } catch (err) {
    console.error("[proactive] consent opt-out persist failed", err);
  }
}
