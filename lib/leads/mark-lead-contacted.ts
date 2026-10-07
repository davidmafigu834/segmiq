import { logStatusChanged } from "@/lib/lead-events";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A successful human outbound may promote NEW → CONTACTED.
 * Failed sends, system actors, and any later status do not.
 */
export function shouldAutoContactAfterOutbound(input: {
  sendSucceeded: boolean;
  humanActor: boolean;
  leadStatus: string | null | undefined;
}): boolean {
  return input.sendSucceeded && input.humanActor && input.leadStatus === "NEW";
}

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

  if (
    !shouldAutoContactAfterOutbound({
      sendSucceeded: true,
      humanActor: true,
      leadStatus: lead?.status,
    })
  ) {
    return;
  }

  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("leads")
    .update({ status: "CONTACTED", updated_at: now })
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
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
