import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationEventType } from "@/types";

type Actor = { id: string | null; name: string };

/**
 * Record a commercially meaningful quotation event.
 * Never throws — audit must not break the main action.
 */
export async function logQuotationEvent(
  supabase: SupabaseClient,
  opts: {
    quotationId: string;
    clientId: string;
    leadId?: string | null;
    dealId?: string | null;
    actor: Actor;
    eventType: QuotationEventType | string;
    eventData?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("quotation_events").insert({
      quotation_id: opts.quotationId,
      client_id: opts.clientId,
      lead_id: opts.leadId ?? null,
      deal_id: opts.dealId ?? null,
      actor_id: opts.actor.id,
      actor_name: opts.actor.name || "System",
      event_type: opts.eventType,
      event_data: opts.eventData ?? {},
    });
    if (error) console.error("[quotation_events]", error.message);
  } catch (e) {
    console.error("[quotation_events]", e);
  }
}

export function quotationEventLabel(type: string): string {
  const map: Record<string, string> = {
    CREATED: "Created",
    EDITED: "Edited",
    APPROVAL_REQUESTED: "Approval requested",
    APPROVED: "Approved",
    CHANGES_REQUESTED: "Changes requested",
    SENT: "Sent",
    VIEWED: "Viewed",
    CUSTOMER_RESPONDED: "Customer responded",
    REVISION_CREATED: "Revision created",
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    EXPIRED: "Expired",
    SUPERSEDED: "Superseded",
    PDF_DOWNLOADED: "Downloaded PDF",
    FOLLOW_UP_SCHEDULED: "Follow-up scheduled",
    APPROVAL_INVALIDATED: "Approval invalidated",
    RESUBMITTED: "Resubmitted for approval",
    REJECTED: "Rejected",
    PRICE_OVERRIDE: "Price override",
    CUSTOMER_SELECTED_OPTION: "Customer selected option",
    CUSTOMER_REQUESTED_CHANGES: "Customer requested changes",
    CUSTOMER_ASKED_QUESTION: "Customer asked a question",
    MATERIAL_CHANGE: "Material commercial change",
    DUPLICATED: "Duplicated",
    CANCELLED: "Cancelled",
  };
  return map[type] ?? type.replace(/_/g, " ").toLowerCase();
}
