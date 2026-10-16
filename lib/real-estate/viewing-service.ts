import { createAdminClient } from "@/lib/supabase/admin";
import { appendInterestedListingIds, listingLabel } from "@/lib/real-estate/helpers";
import { isDemandSide } from "@/lib/real-estate/requirements";
import { recordPropertyInterest } from "@/lib/real-estate/foundation-sync";
import { logReActivity } from "@/lib/lead-events";
import { notifyViewingConfirmation } from "@/lib/real-estate/notifications";

export type ViewingActor = {
  id: string | null;
  name: string;
  role: string;
};

export type CreateScheduledViewingInput = {
  clientId: string;
  contactId: string;
  listingId: string;
  agentId: string;
  scheduledAt: string;
  actor: ViewingActor;
  leadId?: string | null;
  notifyCustomer?: boolean;
  buyerSearchId?: string | null;
  confirmationStatus?: "tentative" | "awaiting_confirmation" | "confirmed" | "rescheduled" | null;
  instructions?: string | null;
  idempotencyKey?: string | null;
};

export async function createScheduledViewing(
  input: CreateScheduledViewingInput
): Promise<{ ok: true; viewing: Record<string, unknown> } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone, client_id, interested_listing_ids")
    .eq("id", input.contactId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "Contact not found" };

  const { data: listing } = await supabase
    .from("listings")
    .select("id, address, suburb, client_id")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found" };

  const viewingInsert: Record<string, unknown> = {
    contact_id: input.contactId,
    listing_id: input.listingId,
    client_id: input.clientId,
    agent_id: input.agentId,
    scheduled_at: input.scheduledAt,
    status: "scheduled",
  };
  if (input.buyerSearchId) viewingInsert.buyer_search_id = input.buyerSearchId;
  if (input.confirmationStatus) viewingInsert.confirmation_status = input.confirmationStatus;
  if (input.instructions) viewingInsert.instructions = input.instructions;
  if (input.idempotencyKey) viewingInsert.idempotency_key = input.idempotencyKey;
  let viewingResult = await supabase.from("viewings").insert(viewingInsert).select("*").single();
  if (
    viewingResult.error &&
    /client_id|buyer_search_id|confirmation_status|instructions|idempotency_key|schema cache/i.test(viewingResult.error.message)
  ) {
    const legacyInsert = {
      contact_id: input.contactId,
      listing_id: input.listingId,
      agent_id: input.agentId,
      scheduled_at: input.scheduledAt,
      status: "scheduled",
    };
    viewingResult = await supabase.from("viewings").insert(legacyInsert).select("*").single();
  }
  const viewing = viewingResult.data;
  const error = viewingResult.error;
  if (error || !viewing) {
    return { ok: false, error: error?.message ?? "Could not create viewing" };
  }

  const { data: demandLead } = await supabase
    .from("leads")
    .select("deal_side")
    .eq("client_id", input.clientId)
    .eq("contact_id", input.contactId)
    .in("deal_side", ["buy_side", "tenant_side"])
    .limit(1);
  await recordPropertyInterest({
    clientId: input.clientId,
    contactId: input.contactId,
    listingId: input.listingId,
    agentId: input.agentId,
    source: "viewing",
    explicitDemand: demandLead?.some((lead) => isDemandSide(lead.deal_side as string)) ?? false,
  });

  const nextIds = appendInterestedListingIds(contact.interested_listing_ids, input.listingId);
  await supabase
    .from("contacts")
    .update({ interested_listing_ids: nextIds, updated_at: new Date().toISOString() })
    .eq("id", contact.id);

  if (input.notifyCustomer !== false && contact.phone) {
    const { data: agent } = await supabase
      .from("users")
      .select("name")
      .eq("id", input.agentId)
      .maybeSingle();
    await notifyViewingConfirmation({
      clientId: input.clientId,
      to: contact.phone as string,
      contactName: (contact.name as string | null) ?? null,
      listing,
      scheduledAt: input.scheduledAt,
      agentName: (agent?.name as string | null) ?? null,
    });
  }

  const leadId = input.leadId ?? (await resolveLeadIdForContact(input.clientId, input.contactId));
  if (leadId) {
    await logReActivity({
      leadId,
      clientId: input.clientId,
      actor: input.actor,
      summary: "Viewing scheduled",
      kind: "viewing_scheduled",
    }).catch(() => null);
  }

  return { ok: true, viewing: viewing as Record<string, unknown> };
}

async function resolveLeadIdForContact(clientId: string, contactId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false })
    .maybeSingle();
  return (lead?.id as string | null) ?? null;
}

export function formatViewingListingLabel(listing: {
  address?: string | null;
  suburb?: string | null;
}): string {
  return listingLabel(listing);
}
