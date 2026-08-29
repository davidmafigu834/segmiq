import { createAdminClient } from "@/lib/supabase/admin";
import {
  markedInterestedFromFormData,
  RE_ACTIVE_STAGES,
  rePipelineStageLabel,
  resolveRePipelineStage,
  type RePipelineStage,
} from "@/lib/real-estate/pipeline";
import { derivePriorityItem, rankPriorityItems, type PriorityItem } from "@/lib/real-estate/priority";
import { operationalComplianceLabel, type ComplianceStatus } from "@/lib/real-estate/compliance";

export type RePipelineColumn = {
  id: RePipelineStage;
  label: string;
  count: number;
  items: Array<{
    id: string;
    name: string;
    phone: string | null;
    dealSide: string | null;
    ownerName: string | null;
    ownerId: string | null;
    complianceLabel: string | null;
    stage: RePipelineStage;
    followUpAt: string | null;
    updatedAt: string;
  }>;
};

export type ReAgentWorkload = {
  id: string;
  name: string;
  activeInquiries: number;
  followUpsDue: number;
  viewingsThisWeek: number;
};

export type RealEstatePipelineData = {
  columns: RePipelineColumn[];
  closed: RePipelineColumn[];
  workload: ReAgentWorkload[];
  attention: PriorityItem[];
};

export async function getRealEstatePipelineData(opts: {
  clientId: string;
  assignedToId?: string | null;
}): Promise<RealEstatePipelineData> {
  const supabase = createAdminClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(dayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let leadsQuery = supabase
    .from("leads")
    .select(
      "id, name, phone, status, deal_side, contact_id, assigned_to_id, follow_up_date, created_at, updated_at, form_data, linked_listing_id, offer_status"
    )
    .eq("client_id", opts.clientId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("updated_at", { ascending: false })
    .limit(400);
  if (opts.assignedToId) leadsQuery = leadsQuery.eq("assigned_to_id", opts.assignedToId);

  const [{ data: leadRows }, { data: teamRows }, { data: listingRows }] = await Promise.all([
    leadsQuery,
    supabase
      .from("users")
      .select("id, name, role, is_active")
      .eq("client_id", opts.clientId)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"]),
    supabase.from("listings").select("id").eq("client_id", opts.clientId),
  ]);

  const leads = leadRows ?? [];
  const team = teamRows ?? [];
  const listingIds = (listingRows ?? []).map((l) => l.id as string);
  const contactIds = [...new Set(leads.map((l) => l.contact_id as string | null).filter(Boolean))] as string[];

  const [{ data: contacts }, { data: viewings }] = await Promise.all([
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id, interested_listing_ids")
          .eq("client_id", opts.clientId)
          .in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    listingIds.length
      ? supabase
          .from("viewings")
          .select("id, contact_id, agent_id, scheduled_at, status")
          .in("listing_id", listingIds)
          .gte("scheduled_at", dayStart.toISOString())
          .lt("scheduled_at", weekEnd.toISOString())
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const teamById = new Map(team.map((u) => [u.id as string, u]));
  const upcomingByContact = new Set(
    (viewings ?? [])
      .filter((v) => v.status === "scheduled")
      .map((v) => v.contact_id as string)
  );
  const completedByContact = new Set(
    (viewings ?? []).filter((v) => v.status === "completed").map((v) => v.contact_id as string)
  );

  type Enriched = {
    id: string;
    name: string;
    phone: string | null;
    dealSide: string | null;
    ownerId: string | null;
    ownerName: string | null;
    stage: RePipelineStage;
    followUpAt: string | null;
    createdAt: string;
    updatedAt: string;
    hasMatch: boolean;
    complianceLabel: string | null;
  };

  const leadIds = leads.map((l) => l.id as string);
  const { data: complianceRows } = leadIds.length
    ? await supabase
        .from("compliance_cases")
        .select("lead_id, status")
        .eq("client_id", opts.clientId)
        .in("lead_id", leadIds)
    : { data: [] as Array<Record<string, unknown>> };
  const complianceByLead = new Map<string, string>();
  for (const c of complianceRows ?? []) {
    if (c.lead_id && !complianceByLead.has(c.lead_id as string)) {
      complianceByLead.set(c.lead_id as string, c.status as string);
    }
  }

  const enriched: Enriched[] = leads.map((lead) => {
    const contact = lead.contact_id
      ? (contactById.get(lead.contact_id as string) as { interested_listing_ids?: unknown } | undefined)
      : undefined;
    const interested = Array.isArray(contact?.interested_listing_ids)
      ? (contact!.interested_listing_ids as unknown[]).length > 0
      : false;
    const stage = resolveRePipelineStage({
      leadStatus: lead.status as string,
      offerStatus: lead.offer_status as string | null,
      hasInterestedListing: interested,
      hasLinkedListing: Boolean(lead.linked_listing_id),
      hasUpcomingViewing: Boolean(lead.contact_id && upcomingByContact.has(lead.contact_id as string)),
      hasCompletedViewing: Boolean(lead.contact_id && completedByContact.has(lead.contact_id as string)),
      markedInterested: markedInterestedFromFormData(lead.form_data as Record<string, unknown>),
    });
    const owner = lead.assigned_to_id ? teamById.get(lead.assigned_to_id as string) : null;
    return {
      id: lead.id as string,
      name: (lead.name as string | null) || "Inquiry",
      phone: (lead.phone as string | null) ?? null,
      dealSide: (lead.deal_side as string | null) ?? null,
      ownerId: (lead.assigned_to_id as string | null) ?? null,
      ownerName: (owner?.name as string | null) ?? null,
      stage,
      followUpAt: (lead.follow_up_date as string | null) ?? null,
      createdAt: lead.created_at as string,
      updatedAt: lead.updated_at as string,
      hasMatch: interested || Boolean(lead.linked_listing_id),
      complianceLabel: operationalComplianceLabel(
        (complianceByLead.get(lead.id as string) as ComplianceStatus | undefined) ?? null
      ),
    };
  });

  function column(id: RePipelineStage): RePipelineColumn {
    const items = enriched.filter((e) => e.stage === id);
    return {
      id,
      label: rePipelineStageLabel(id),
      count: items.length,
      items: items.slice(0, 40).map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        dealSide: e.dealSide,
        ownerName: e.ownerName,
        ownerId: e.ownerId,
        complianceLabel: e.stage === "offer_accepted" ? e.complianceLabel ?? "CDD not started" : null,
        stage: e.stage,
        followUpAt: e.followUpAt,
        updatedAt: e.updatedAt,
      })),
    };
  }

  const attention = rankPriorityItems(
    enriched
      .map((e) =>
        derivePriorityItem({
          id: e.id,
          name: e.name,
          dealSide: e.dealSide,
          stage: e.stage,
          assignedToId: e.ownerId,
          createdAt: e.createdAt,
          followUpAt: e.followUpAt,
          lastActivityAt: e.updatedAt,
          hasPropertyMatch: e.hasMatch,
        }, now)
      )
      .filter((x): x is PriorityItem => Boolean(x))
  ).slice(0, 15);

  const viewingsThisWeekByAgent = new Map<string, number>();
  for (const v of viewings ?? []) {
    if (!v.agent_id) continue;
    viewingsThisWeekByAgent.set(
      v.agent_id as string,
      (viewingsThisWeekByAgent.get(v.agent_id as string) ?? 0) + 1
    );
  }

  const nowMs = now.getTime();
  const workload: ReAgentWorkload[] = team
    .filter((u) => u.is_active !== false && (u.role === "SALESPERSON" || u.role === "CLIENT_MANAGER"))
    .map((u) => {
      const mine = enriched.filter((e) => e.ownerId === u.id);
      const active = mine.filter((e) => !["won", "lost", "not_qualified"].includes(e.stage));
      const followUpsDue = mine.filter(
        (e) => e.followUpAt && new Date(e.followUpAt).getTime() <= nowMs
      ).length;
      return {
        id: u.id as string,
        name: (u.name as string | null) || "Agent",
        activeInquiries: active.length,
        followUpsDue,
        viewingsThisWeek: viewingsThisWeekByAgent.get(u.id as string) ?? 0,
      };
    })
    .filter((w) => w.activeInquiries > 0 || w.followUpsDue > 0 || w.viewingsThisWeek > 0)
    .sort((a, b) => b.activeInquiries - a.activeInquiries);

  return {
    columns: RE_ACTIVE_STAGES.map(column),
    closed: (["won", "lost", "not_qualified"] as RePipelineStage[]).map(column),
    workload,
    attention,
  };
}
