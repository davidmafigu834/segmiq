import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  markedInterestedFromFormData,
  resolveRePipelineStage,
} from "@/lib/real-estate/pipeline";
import { derivePriorityItem, rankPriorityItems, type PriorityItem } from "@/lib/real-estate/priority";
import {
  deriveOfferAttention,
  effectiveOfferStatus,
  formatOfferMoney,
  rankOfferAttention,
  relativeTimeLabel,
  type OfferAttentionReason,
  type ReOfferStatus,
} from "@/lib/real-estate/offers";
import { listAgentComplianceActions } from "@/lib/real-estate/compliance-service";

export type AgentReDashboard = {
  summary: {
    newInquiries: number;
    followUpsDue: number;
    viewingsToday: number;
    needingAttention: number;
  };
  priorities: PriorityItem[];
  viewingsToday: Array<{
    id: string;
    scheduledAt: string;
    contactName: string | null;
    listingLabel: string;
    leadId: string | null;
    listingId: string;
  }>;
  followUps: Array<{
    leadId: string;
    name: string;
    dueAt: string;
    overdue: boolean;
    note: string | null;
  }>;
  offersNeedingAttention: Array<{
    id: string;
    buyerName: string | null;
    propertyLabel: string;
    why: string;
    amountLabel: string | null;
    updatedLabel: string;
    reason: OfferAttentionReason;
    leadId: string | null;
  }>;
  complianceActions: Array<{
    id: string;
    contactName: string;
    why: string;
    nextLabel: string;
  }>;
};

export async function getAgentRealEstateDashboard(opts: {
  clientId: string;
  userId: string;
}): Promise<AgentReDashboard> {
  const supabase = createAdminClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const yesterdayStart = new Date(dayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const { data: leadRows } = await supabase
    .from("leads")
    .select(
      "id, name, status, deal_side, contact_id, assigned_to_id, follow_up_date, convert_later_note, created_at, updated_at, form_data, linked_listing_id, offer_status"
    )
    .eq("client_id", opts.clientId)
    .eq("assigned_to_id", opts.userId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("updated_at", { ascending: false })
    .limit(300);

  const leads = leadRows ?? [];
  const contactIds = [...new Set(leads.map((l) => l.contact_id as string | null).filter(Boolean))] as string[];

  const { data: listingRows } = await supabase.from("listings").select("id, address, suburb").eq("client_id", opts.clientId);
  const listingIds = (listingRows ?? []).map((l) => l.id as string);
  const listingById = new Map(
    (listingRows ?? []).map((l) => [l.id as string, listingLabel(l)])
  );

  const [{ data: contactRows }, { data: viewingRows }] = await Promise.all([
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id, name, interested_listing_ids")
          .eq("client_id", opts.clientId)
          .in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    listingIds.length
      ? supabase
          .from("viewings")
          .select("id, contact_id, listing_id, agent_id, scheduled_at, status")
          .eq("agent_id", opts.userId)
          .in("listing_id", listingIds)
          .gte("scheduled_at", yesterdayStart.toISOString())
          .lt("scheduled_at", dayEnd.toISOString())
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const contactById = new Map((contactRows ?? []).map((c) => [c.id as string, c]));
  const viewings = viewingRows ?? [];
  const leadByContact = new Map<string, string>();
  for (const l of leads) {
    if (l.contact_id) leadByContact.set(l.contact_id as string, l.id as string);
  }

  const viewingsToday = viewings
    .filter((v) => {
      const t = new Date(v.scheduled_at as string).getTime();
      return (v.status as string) === "scheduled" && t >= dayStart.getTime() && t < dayEnd.getTime();
    })
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
    .map((v) => ({
      id: v.id as string,
      scheduledAt: v.scheduled_at as string,
      contactName: (contactById.get(v.contact_id as string) as { name?: string } | undefined)?.name ?? null,
      listingLabel: listingById.get(v.listing_id as string) ?? "Listing",
      leadId: leadByContact.get(v.contact_id as string) ?? null,
      listingId: v.listing_id as string,
    }));

  const completedYesterday = new Set(
    viewings
      .filter((v) => {
        const t = new Date(v.scheduled_at as string).getTime();
        return (
          (v.status as string) === "completed" &&
          t >= yesterdayStart.getTime() &&
          t < dayStart.getTime()
        );
      })
      .map((v) => v.contact_id as string)
  );

  const viewingTodayContacts = new Set(viewingsToday.map((v) => {
    const row = viewings.find((x) => x.id === v.id);
    return row?.contact_id as string;
  }));

  const priorities: PriorityItem[] = [];
  for (const lead of leads) {
    const contact = lead.contact_id
      ? (contactById.get(lead.contact_id as string) as
          | { interested_listing_ids?: unknown }
          | undefined)
      : undefined;
    const interested = Array.isArray(contact?.interested_listing_ids)
      ? (contact!.interested_listing_ids as unknown[]).length > 0
      : false;
    const stage = resolveRePipelineStage({
      leadStatus: lead.status as string,
      offerStatus: lead.offer_status as string | null,
      hasInterestedListing: interested,
      hasLinkedListing: Boolean(lead.linked_listing_id),
      hasUpcomingViewing: Boolean(
        lead.contact_id && viewingTodayContacts.has(lead.contact_id as string)
      ),
      hasCompletedViewing: Boolean(
        lead.contact_id && completedYesterday.has(lead.contact_id as string)
      ),
      markedInterested: markedInterestedFromFormData(lead.form_data as Record<string, unknown>),
    });
    const item = derivePriorityItem({
      id: lead.id as string,
      name: (lead.name as string | null) || "Inquiry",
      dealSide: (lead.deal_side as string | null) ?? null,
      stage,
      assignedToId: (lead.assigned_to_id as string | null) ?? null,
      createdAt: lead.created_at as string,
      followUpAt: (lead.follow_up_date as string | null) ?? null,
      lastActivityAt: (lead.updated_at as string | null) ?? null,
      hasUpcomingViewingToday: Boolean(
        lead.contact_id && viewingTodayContacts.has(lead.contact_id as string)
      ),
      viewingCompletedYesterday: Boolean(
        lead.contact_id && completedYesterday.has(lead.contact_id as string)
      ),
      hasPropertyMatch: interested || Boolean(lead.linked_listing_id),
    }, now);
    if (item) priorities.push(item);
  }

  const ranked = rankPriorityItems(priorities).slice(0, 12);

  const followUps = leads
    .filter((l) => l.follow_up_date)
    .map((l) => {
      const due = new Date(l.follow_up_date as string);
      return {
        leadId: l.id as string,
        name: (l.name as string | null) || "Inquiry",
        dueAt: l.follow_up_date as string,
        overdue: due.getTime() < dayStart.getTime(),
        note: (l.convert_later_note as string | null) ?? null,
      };
    })
    .filter((f) => new Date(f.dueAt).getTime() < dayEnd.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 12);

  const newInquiries = leads.filter((l) => String(l.status).toUpperCase() === "NEW").length;

  const offerRes = await supabase
    .from("real_estate_offers")
    .select(
      "id, listing_id, contact_id, lead_id, status, current_offer_amount, currency, expiry_date, updated_at"
    )
    .eq("client_id", opts.clientId)
    .eq("buyer_agent_id", opts.userId)
    .order("updated_at", { ascending: false })
    .limit(80);

  const offerList = offerRes.error ? [] : offerRes.data ?? [];
  const offerContactIds = [...new Set(offerList.map((o) => o.contact_id as string))];
  const { data: offerContacts } =
    offerContactIds.length > 0
      ? await supabase.from("contacts").select("id, name").eq("client_id", opts.clientId).in("id", offerContactIds)
      : { data: [] as Array<Record<string, unknown>> };
  const offerContactById = new Map((offerContacts ?? []).map((c) => [c.id as string, c.name as string | null]));

  const offersNeedingAttention = rankOfferAttention(
    offerList
      .map((o) => {
        const status = effectiveOfferStatus(o.status as ReOfferStatus, o.expiry_date as string | null, now);
        const att = deriveOfferAttention(
          {
            status,
            updatedAt: o.updated_at as string,
            expiryDate: (o.expiry_date as string | null) ?? null,
          },
          now
        );
        if (!att) return null;
        return {
          id: o.id as string,
          buyerName: offerContactById.get(o.contact_id as string) ?? null,
          propertyLabel: listingById.get(o.listing_id as string) ?? "Property",
          why: att.why,
          amountLabel: formatOfferMoney(Number(o.current_offer_amount), (o.currency as string) || "USD"),
          updatedLabel: relativeTimeLabel(o.updated_at as string, now),
          reason: att.reason,
          leadId: (o.lead_id as string | null) ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
  ).slice(0, 8);

  const complianceActions = await listAgentComplianceActions({
    clientId: opts.clientId,
    userId: opts.userId,
  });

  return {
    summary: {
      newInquiries,
      followUpsDue: followUps.length,
      viewingsToday: viewingsToday.length,
      needingAttention: ranked.length + offersNeedingAttention.length + complianceActions.length,
    },
    priorities: ranked,
    viewingsToday,
    followUps,
    offersNeedingAttention,
    complianceActions,
  };
}
