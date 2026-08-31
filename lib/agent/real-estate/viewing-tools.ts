import { createAdminClient } from "@/lib/supabase/admin";
import { logReActivity } from "@/lib/lead-events";
import { createScheduledViewing, formatViewingListingLabel } from "@/lib/real-estate/viewing-service";
import { notifyAgentAlert } from "@/lib/agent/notifications";
import { createAgentEscalation } from "@/lib/agent/escalation";
import { updateConversationAgentState } from "@/lib/agent/conversation-state";
import { formatLocalDateTime, wallTimeToUtc } from "@/lib/agent/dates";
import { AGENT_ACTOR, toolFailure, toolSuccess, type ToolExecutionContext, type ToolResult } from "@/lib/agent/tools/context";
import { getListingForClient, summarizeListingForAgent } from "./match-service";
import { resolveViewingAgent, VIEWING_ROUTE_REASON_LABELS } from "./routing";
import { getViewingAgentAvailability } from "./viewing-availability";

async function resolveViewingListingId(
  ctx: ToolExecutionContext,
  listingId: string | undefined
): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  if (listingId?.trim()) {
    const listing = await getListingForClient({ clientId: ctx.clientId, listingId: listingId.trim() });
    if (!listing) return { ok: false, error: "Listing not found for this company." };
    return { ok: true, listingId: listing.id };
  }
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("linked_listing_id")
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  const linked = (lead?.linked_listing_id as string | null) ?? null;
  if (!linked) {
    return {
      ok: false,
      error: "No listing specified and none linked to this inquiry. Ask which property they want to view.",
    };
  }
  return { ok: true, listingId: linked };
}

async function loadCustomerPhone(ctx: ToolExecutionContext): Promise<string | null> {
  if (!ctx.contactId) return null;
  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("phone")
    .eq("id", ctx.contactId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  return (contact?.phone as string | null) ?? null;
}

function resolveRequestedInstant(
  ctx: ToolExecutionContext,
  date: string,
  time: string
): { ok: true; utc: Date } | { ok: false; error: string } {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return { ok: false, error: "Invalid date or time format." };
  const utc = wallTimeToUtc(
    ctx.timezone,
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2])
  );
  if (Number.isNaN(utc.getTime())) return { ok: false, error: "Invalid date/time." };
  if (utc.getTime() <= Date.now()) {
    return { ok: false, error: "The requested time is in the past. Ask for a future time." };
  }
  return { ok: true, utc };
}

export async function executeViewingGetAvailability(
  ctx: ToolExecutionContext,
  input: { listing_id?: string; date: string }
): Promise<ToolResult> {
  const listing = await resolveViewingListingId(ctx, input.listing_id);
  if (!listing.ok) return toolFailure(listing.error);

  const phone = await loadCustomerPhone(ctx);
  const route = await resolveViewingAgent({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    contactId: ctx.contactId,
    listingId: listing.listingId,
    phone,
  });
  if (!route.agentId) {
    return toolFailure(
      "No viewing agent is available to check. Escalate so a manager can assign someone."
    );
  }

  const availability = await getViewingAgentAvailability({
    clientId: ctx.clientId,
    agentId: route.agentId,
    agentName: route.agentName,
    timezone: ctx.timezone,
    localDate: input.date,
    workingDays: ctx.workingDays,
    workStartTime: ctx.workStartTime,
    workEndTime: ctx.workEndTime,
  });
  if ("ok" in availability && availability.ok === false) {
    return toolFailure(availability.error);
  }

  const listingRow = await getListingForClient({ clientId: ctx.clientId, listingId: listing.listingId });
  return toolSuccess({
    date: availability.date,
    timezone: availability.timezone,
    listing: listingRow ? summarizeListingForAgent(listingRow) : { listingId: listing.listingId },
    viewing_agent: route.agentName ?? "assigned agent",
    route_reason: VIEWING_ROUTE_REASON_LABELS[route.reason] ?? route.reason,
    busy_times: availability.busyLocalTimes,
    available_times: availability.suggestedLocalTimes,
    working_hours: availability.workingHours,
    note: "Offer only times listed in available_times. Never invent slots.",
  });
}

export async function executeViewingRequestApproval(
  ctx: ToolExecutionContext,
  input: {
    listing_id?: string;
    date: string;
    time: string;
    customer_request?: string;
  }
): Promise<ToolResult> {
  if (!ctx.contactId) return toolFailure("No contact record exists for this viewing request.");

  const listing = await resolveViewingListingId(ctx, input.listing_id);
  if (!listing.ok) return toolFailure(listing.error);

  const instant = resolveRequestedInstant(ctx, input.date, input.time);
  if (!instant.ok) return toolFailure(instant.error);

  const phone = await loadCustomerPhone(ctx);
  const route = await resolveViewingAgent({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    contactId: ctx.contactId,
    listingId: listing.listingId,
    phone,
  });
  if (!route.agentId) {
    return toolFailure("No viewing agent is available. Escalate to a manager.");
  }

  const listingRow = await getListingForClient({ clientId: ctx.clientId, listingId: listing.listingId });
  const propertyLabel = listingRow ? formatViewingListingLabel(listingRow) : "the property";
  const whenLabel = formatLocalDateTime(instant.utc.toISOString(), ctx.timezone);

  if (ctx.testMode) {
    return toolSuccess({
      simulated: true,
      viewing_agent: route.agentName,
      requested_for: whenLabel,
      property: propertyLabel,
    });
  }

  await notifyAgentAlert({
    userId: route.agentId,
    leadId: ctx.leadId,
    message: `Viewing approval needed: ${propertyLabel} on ${whenLabel}.${input.customer_request ? ` Customer: ${input.customer_request.slice(0, 120)}` : ""}`,
  });

  await createAgentEscalation({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    executionId: ctx.executionId,
    reason: "COMMERCIAL_APPROVAL",
    summary: `Viewing approval: ${propertyLabel} on ${whenLabel}`,
    briefing: {
      cardType: "VIEWING_APPROVAL",
      listing_id: listing.listingId,
      date: input.date,
      time: input.time,
      property_label: propertyLabel,
      requested_for: whenLabel,
      viewing_agent_id: route.agentId,
      viewing_agent_name: route.agentName,
      customer_request: input.customer_request ?? null,
    },
    ownerId: route.agentId,
    escalationUserId: ctx.settings.escalationUserId,
  });

  await updateConversationAgentState(ctx.clientId, ctx.leadId, {
    status: "HUMAN_NEEDED",
    humanNeededReason: "VIEWING_APPROVAL",
  });

  await logReActivity({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    summary: `Viewing approval requested for ${propertyLabel} (${whenLabel})`,
    kind: "viewing_scheduled",
  }).catch(() => null);

  return toolSuccess({
    approval_requested: true,
    viewing_agent: route.agentName,
    route_reason: VIEWING_ROUTE_REASON_LABELS[route.reason] ?? route.reason,
    requested_for: whenLabel,
    property: propertyLabel,
    note: "Tell the customer you are checking with the listing agent. Do not confirm the viewing until approved.",
  });
}

export async function executeViewingSchedule(
  ctx: ToolExecutionContext,
  input: {
    listing_id?: string;
    date: string;
    time: string;
    customer_request?: string;
  }
): Promise<ToolResult> {
  if (!ctx.contactId) return toolFailure("No contact record exists, so a viewing cannot be scheduled.");

  const listing = await resolveViewingListingId(ctx, input.listing_id);
  if (!listing.ok) return toolFailure(listing.error);

  const instant = resolveRequestedInstant(ctx, input.date, input.time);
  if (!instant.ok) return toolFailure(instant.error);

  const phone = await loadCustomerPhone(ctx);
  const route = await resolveViewingAgent({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    contactId: ctx.contactId,
    listingId: listing.listingId,
    phone,
  });
  if (!route.agentId) {
    return toolFailure("No viewing agent is available. Escalate to a manager.");
  }

  const availability = await getViewingAgentAvailability({
    clientId: ctx.clientId,
    agentId: route.agentId,
    agentName: route.agentName,
    timezone: ctx.timezone,
    localDate: input.date,
    workingDays: ctx.workingDays,
    workStartTime: ctx.workStartTime,
    workEndTime: ctx.workEndTime,
  });
  if ("ok" in availability && availability.ok === false) {
    return toolFailure(availability.error);
  }
  if (availability.busyLocalTimes.includes(input.time)) {
    return toolFailure(
      `${route.agentName ?? "The viewing agent"} is unavailable at ${input.time} on ${input.date}.`,
      { alternative_times: availability.suggestedLocalTimes }
    );
  }

  const whenLabel = formatLocalDateTime(instant.utc.toISOString(), ctx.timezone);
  const listingRow = await getListingForClient({ clientId: ctx.clientId, listingId: listing.listingId });

  if (ctx.testMode) {
    return toolSuccess({
      simulated: true,
      scheduled_for: whenLabel,
      viewing_agent: route.agentName,
      property: listingRow ? summarizeListingForAgent(listingRow).label : listing.listingId,
    });
  }

  const created = await createScheduledViewing({
    clientId: ctx.clientId,
    contactId: ctx.contactId,
    listingId: listing.listingId,
    agentId: route.agentId,
    scheduledAt: instant.utc.toISOString(),
    actor: AGENT_ACTOR,
    leadId: ctx.leadId,
    notifyCustomer: true,
  });
  if (!created.ok) return toolFailure(created.error);

  return toolSuccess(
    {
      scheduled_for: whenLabel,
      viewing_agent: route.agentName,
      route_reason: VIEWING_ROUTE_REASON_LABELS[route.reason] ?? route.reason,
      property: listingRow ? summarizeListingForAgent(listingRow).label : listing.listingId,
      customer_request: input.customer_request ?? null,
    },
    { type: "viewing", id: created.viewing.id as string }
  );
}
