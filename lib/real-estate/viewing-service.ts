import { createAdminClient } from "@/lib/supabase/admin";
import { appendInterestedListingIds, listingLabel } from "@/lib/real-estate/helpers";
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

  const { data: viewing, error } = await supabase
    .from("viewings")
    .insert({
      contact_id: input.contactId,
      listing_id: input.listingId,
      agent_id: input.agentId,
      scheduled_at: input.scheduledAt,
      status: "scheduled",
    })
    .select("*")
    .single();
  if (error || !viewing) {
    return { ok: false, error: error?.message ?? "Could not create viewing" };
  }

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
