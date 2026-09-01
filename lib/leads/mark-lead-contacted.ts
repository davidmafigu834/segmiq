import { logStatusChanged } from "@/lib/lead-events";
import { createAdminClient } from "@/lib/supabase/admin";

/** First real salesperson contact — mirrors call-log NEW → CONTACTED promotion. */
export async function markLeadContactedIfNew(opts: {
  leadId: string;
  clientId: string;
  actor: { id: string | null; name: string; role: string };
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!lead || lead.status !== "NEW") return;

  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("leads")
    .update({ status: "CONTACTED", updated_at: now })
    .eq("id", opts.leadId)
    .eq("status", "NEW")
    .select("id")
    .maybeSingle();

  if (!updated) return;

  await logStatusChanged({
    leadId: opts.leadId,
    clientId: opts.clientId,
    actor: opts.actor,
    fromStatus: "NEW",
    toStatus: "CONTACTED",
  });
}
