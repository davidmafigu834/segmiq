import type { SupabaseClient } from "@supabase/supabase-js";
import { logQuotationEvent } from "@/lib/quotations/events";

/** Mark sent/viewed quotations expired once when validity has passed. */
export async function expireOverdueQuotations(supabase: SupabaseClient): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("quotations")
    .select("id, client_id, lead_id, deal_id, quote_number")
    .in("status", ["sent", "viewed"])
    .lt("valid_until", today)
    .limit(500);

  let count = 0;
  for (const q of data ?? []) {
    const { data: updated } = await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", q.id)
      .in("status", ["sent", "viewed"])
      .select("id")
      .maybeSingle();
    if (!updated) continue;
    count += 1;
    await logQuotationEvent(supabase, {
      quotationId: q.id as string,
      clientId: q.client_id as string,
      leadId: (q.lead_id as string) || null,
      dealId: (q.deal_id as string) || null,
      actor: { id: null, name: "System" },
      eventType: "EXPIRED",
      eventData: { quote_number: q.quote_number },
    });
  }
  return count;
}
