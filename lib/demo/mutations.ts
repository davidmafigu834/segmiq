import type { DealRow, DealStage, LeadRow } from "@/types";
import { demoId } from "@/lib/demo/ids";
import type { DemoActivity, DemoDataset, DemoFollowUp, DemoMessage, DemoMutation } from "@/lib/demo/types";

const ACTIVE = new Set<DealStage>(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function actorKeyForUser(dataset: DemoDataset, userId: string) {
  return Object.values(dataset.actors).find((actor) => actor.id === userId)?.key ?? "tinashe";
}

function pushActivity(dataset: DemoDataset, activity: Omit<DemoActivity, "id"> & { id?: string }): void {
  dataset.activities.unshift({
    id: activity.id ?? demoId(`activity:${activity.at}:${activity.title}:${dataset.activities.length}`),
    leadId: activity.leadId,
    dealId: activity.dealId,
    actorKey: activity.actorKey,
    title: activity.title,
    detail: activity.detail,
    kind: activity.kind,
    at: activity.at,
  });
}

function touchLead(lead: LeadRow | undefined, at: string): void {
  if (!lead) return;
  lead.updated_at = at;
}

export function applyDemoMutations(base: DemoDataset, mutations: DemoMutation[]): DemoDataset {
  const dataset = clone(base);
  for (const mutation of mutations) {
    applyOne(dataset, mutation);
  }
  return dataset;
}

function applyOne(dataset: DemoDataset, mutation: DemoMutation): void {
  const actorKey = actorKeyForUser(dataset, mutation.actorUserId);
  if (mutation.type === "message") {
    const message: DemoMessage = {
      id: mutation.id,
      leadId: mutation.leadId,
      direction: "rep",
      text: mutation.text,
      at: mutation.at,
      actorKey,
      kind: mutation.kind === "internal" ? "internal" : "message",
    };
    dataset.messages.push(message);
    const lead = dataset.leads.find((row) => row.id === mutation.leadId);
    touchLead(lead, mutation.at);
    pushActivity(dataset, {
      leadId: mutation.leadId,
      dealId: lead?.active_deal_id ?? null,
      actorKey,
      title: mutation.kind === "internal" ? "Note added" : "Message sent",
      detail: mutation.text,
      kind: mutation.kind === "internal" ? "note" : "whatsapp",
      at: mutation.at,
    });
    return;
  }

  if (mutation.type === "followup.complete") {
    for (const follow of dataset.followUps) {
      if (follow.leadId === mutation.leadId && (mutation.dealId == null || follow.dealId === mutation.dealId)) {
        follow.completed = true;
      }
    }
    const lead = dataset.leads.find((row) => row.id === mutation.leadId);
    if (lead) lead.follow_up_date = null;
    const deal = mutation.dealId ? dataset.deals.find((row) => row.id === mutation.dealId) : undefined;
    if (deal) {
      deal.next_action_at = null;
      deal.next_action_label = null;
      deal.last_meaningful_activity_at = mutation.at;
      deal.updated_at = mutation.at;
    }
    pushActivity(dataset, {
      leadId: mutation.leadId,
      dealId: mutation.dealId,
      actorKey,
      title: "Follow-up completed",
      detail: lead?.name ?? null,
      kind: "call",
      at: mutation.at,
    });
    return;
  }

  if (mutation.type === "followup.create") {
    const follow: DemoFollowUp = {
      id: mutation.id,
      leadId: mutation.leadId,
      dealId: mutation.dealId,
      ownerKey: actorKey,
      label: mutation.label,
      dueAt: mutation.dueAt,
      completed: false,
    };
    dataset.followUps.push(follow);
    const lead = dataset.leads.find((row) => row.id === mutation.leadId);
    if (lead) {
      lead.follow_up_date = mutation.dueAt;
      lead.updated_at = mutation.at;
    }
    const deal = mutation.dealId ? dataset.deals.find((row) => row.id === mutation.dealId) : undefined;
    if (deal) {
      deal.next_action_at = mutation.dueAt;
      deal.next_action_label = mutation.label;
      deal.updated_at = mutation.at;
    }
    pushActivity(dataset, {
      leadId: mutation.leadId,
      dealId: mutation.dealId,
      actorKey,
      title: "Follow-up scheduled",
      detail: mutation.label,
      kind: "call",
      at: mutation.at,
    });
    return;
  }

  const deal = dataset.deals.find((row) => row.id === ("dealId" in mutation ? mutation.dealId : ""));
  if (!deal) return;
  const lead = dataset.leads.find((row) => row.id === deal.originating_lead_id);

  if (mutation.type === "deal.stage") {
    if (!ACTIVE.has(mutation.stage)) return;
    deal.stage = mutation.stage;
    deal.updated_at = mutation.at;
    deal.last_meaningful_activity_at = mutation.at;
    pushActivity(dataset, {
      leadId: deal.originating_lead_id,
      dealId: deal.id,
      actorKey,
      title: `Moved to ${mutation.stage.replace(/_/g, " ").toLowerCase()}`,
      detail: deal.name,
      kind: "deal",
      at: mutation.at,
    });
    return;
  }

  if (mutation.type === "deal.won") {
    deal.stage = "WON";
    deal.won_at = mutation.at;
    deal.won_value = mutation.value;
    deal.value_status = "KNOWN";
    deal.value_basis = "WON_VALUE";
    deal.estimated_value = mutation.value;
    deal.updated_at = mutation.at;
    deal.last_meaningful_activity_at = mutation.at;
    if (lead) {
      lead.status = "WON";
      lead.deal_value = mutation.value;
      lead.updated_at = mutation.at;
    }
    pushActivity(dataset, {
      leadId: deal.originating_lead_id,
      dealId: deal.id,
      actorKey,
      title: "Deal won",
      detail: deal.name,
      kind: "won",
      at: mutation.at,
    });
    return;
  }

  if (mutation.type === "deal.lost") {
    deal.stage = "LOST";
    deal.lost_at = mutation.at;
    deal.lost_reason = mutation.reason;
    deal.updated_at = mutation.at;
    deal.last_meaningful_activity_at = mutation.at;
    if (lead) {
      lead.status = "LOST";
      lead.lost_reason = mutation.reason;
      lead.updated_at = mutation.at;
    }
    pushActivity(dataset, {
      leadId: deal.originating_lead_id,
      dealId: deal.id,
      actorKey,
      title: "Deal lost",
      detail: mutation.reason,
      kind: "deal",
      at: mutation.at,
    });
    return;
  }

  if (mutation.type === "assign") {
    deal.owner_id = mutation.ownerId;
    deal.updated_at = mutation.at;
    if (lead) {
      lead.assigned_to_id = mutation.ownerId;
      lead.updated_at = mutation.at;
    }
    const quote = dataset.quotations.find((row) => row.deal_id === deal.id);
    if (quote) quote.prepared_by_id = mutation.ownerId;
    return;
  }

  if (mutation.type === "deal.fields") {
    const patch = mutation.patch;
    const next = { ...deal, ...patch, id: deal.id, client_id: deal.client_id, updated_at: mutation.at };
    Object.assign(deal, next);
    if (typeof patch.metadata === "object" && patch.metadata) {
      deal.metadata = { ...deal.metadata, ...patch.metadata };
    }
  }
}

export function visibleDeals(dataset: DemoDataset, userId: string, role: string): DealRow[] {
  if (role === "CLIENT_MANAGER" || role === "SUPER_ADMIN") return dataset.deals;
  return dataset.deals.filter((deal) => deal.owner_id === userId);
}

export function visibleLeads(dataset: DemoDataset, userId: string, role: string): LeadRow[] {
  if (role === "CLIENT_MANAGER" || role === "SUPER_ADMIN") return dataset.leads;
  return dataset.leads.filter((lead) => lead.assigned_to_id === userId);
}
