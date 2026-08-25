import { createAdminClient } from "@/lib/supabase/admin";
import { logFollowUpSet } from "@/lib/lead-events";
import { followUpDateFromCallbackAt } from "@/lib/call-log-constants";
import { isWorkingDate, timeToMinutes } from "@/lib/sales/intelligence/operating-hours";
import { formatLocalDateTime, wallTimeToUtc } from "../dates";
import { AGENT_ACTOR, toolFailure, toolSuccess, type ToolExecutionContext, type ToolResult } from "./context";

/**
 * Calendar tools built on the canonical scheduling model:
 * timed callbacks live on call_logs.callback_at (owner-scoped) and
 * leads.follow_up_date carries the date — both feed the existing SegmiQ
 * Calendar, Tasks and Daily Plan. No parallel agent calendar exists.
 */

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const SLOT_MINUTES = 60;

type BusySlot = { startIso: string; endIso: string };

/** All timed callbacks for leads owned by `ownerId` within [dayStart, dayEnd). */
async function loadOwnerBusySlots(opts: {
  clientId: string;
  ownerId: string;
  dayStartUtc: Date;
  dayEndUtc: Date;
}): Promise<BusySlot[]> {
  const supabase = createAdminClient();
  const { data: ownedLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("assigned_to_id", opts.ownerId)
    .limit(2000);
  const leadIds = (ownedLeads ?? []).map((l) => l.id as string);
  if (!leadIds.length) return [];

  const { data: callbacks } = await supabase
    .from("call_logs")
    .select("callback_at")
    .in("lead_id", leadIds)
    .gte("callback_at", opts.dayStartUtc.toISOString())
    .lt("callback_at", opts.dayEndUtc.toISOString())
    .not("callback_at", "is", null);

  return (callbacks ?? [])
    .map((row) => {
      const start = new Date(row.callback_at as string);
      return {
        startIso: start.toISOString(),
        endIso: new Date(start.getTime() + SLOT_MINUTES * 60_000).toISOString(),
      };
    })
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

function overlaps(startIso: string, busy: BusySlot[]): boolean {
  const start = new Date(startIso).getTime();
  const end = start + SLOT_MINUTES * 60_000;
  return busy.some((slot) => {
    const s = new Date(slot.startIso).getTime();
    const e = new Date(slot.endIso).getTime();
    return start < e && end > s;
  });
}

export type AvailabilityResult = {
  date: string;
  timezone: string;
  busyLocalTimes: string[];
  suggestedLocalTimes: string[];
  ownerName: string | null;
};

export async function getOwnerAvailability(
  ctx: ToolExecutionContext,
  localDate: string
): Promise<AvailabilityResult> {
  const [y, m, d] = localDate.split("-").map(Number);
  const dayStartUtc = wallTimeToUtc(ctx.timezone, y, m, d, 0, 0);
  const dayEndUtc = wallTimeToUtc(ctx.timezone, y, m, d, 23, 59);

  const busy = ctx.ownerId
    ? await loadOwnerBusySlots({
        clientId: ctx.clientId,
        ownerId: ctx.ownerId,
        dayStartUtc,
        dayEndUtc,
      })
    : [];

  const busyLocalTimes = busy.map((slot) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ctx.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(slot.startIso))
  );

  const workStart = ctx.workStartTime ? timeToMinutes(ctx.workStartTime) : WORK_START_HOUR * 60;
  const workEnd = ctx.workEndTime ? timeToMinutes(ctx.workEndTime) : WORK_END_HOUR * 60;
  const startHour = Math.floor(workStart / 60);
  const endHour = Math.max(startHour + 1, Math.ceil(workEnd / 60));

  const suggestions: string[] = [];
  const now = Date.now();
  for (let hour = startHour; hour < endHour && suggestions.length < 4; hour++) {
    const slotUtc = wallTimeToUtc(ctx.timezone, y, m, d, hour, 0);
    if (slotUtc.getTime() <= now) continue;
    if (!overlaps(slotUtc.toISOString(), busy)) {
      suggestions.push(`${String(hour).padStart(2, "0")}:00`);
    }
  }

  return {
    date: localDate,
    timezone: ctx.timezone,
    busyLocalTimes,
    suggestedLocalTimes: suggestions,
    ownerName: ctx.ownerName,
  };
}

export async function executeGetAvailability(
  ctx: ToolExecutionContext,
  input: { date: string }
): Promise<ToolResult> {
  if (ctx.workingDays?.length && !isWorkingDate(input.date, ctx.workingDays)) {
    return toolSuccess({
      date: input.date,
      timezone: ctx.timezone,
      owner: ctx.ownerName ?? "unassigned",
      busy_times: [],
      available_times: [],
      working_hours: `${ctx.workStartTime ?? "08:00"}-${ctx.workEndTime ?? "17:00"}`,
      note: "That date is outside company working days. Offer a working day instead.",
    });
  }
  const availability = await getOwnerAvailability(ctx, input.date);
  return toolSuccess({
    date: availability.date,
    timezone: availability.timezone,
    owner: availability.ownerName ?? "unassigned",
    busy_times: availability.busyLocalTimes,
    available_times: availability.suggestedLocalTimes,
    working_hours: `${ctx.workStartTime ?? `${WORK_START_HOUR}:00`}-${ctx.workEndTime ?? `${WORK_END_HOUR}:00`}`,
  });
}

async function resolveRequestedInstant(
  ctx: ToolExecutionContext,
  date: string,
  time: string
): Promise<{ ok: true; utc: Date } | { ok: false; error: string }> {
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
    return { ok: false, error: "The requested time is in the past. Ask the customer for a future time." };
  }
  const horizon = Date.now() + 120 * 24 * 60 * 60 * 1000;
  if (utc.getTime() > horizon) {
    return { ok: false, error: "The requested time is more than 120 days away. Confirm the date with the customer." };
  }
  return { ok: true, utc };
}

export async function executeScheduleCallback(
  ctx: ToolExecutionContext,
  input: { date: string; time: string; purpose: string }
): Promise<ToolResult> {
  if (ctx.operationalRuleKeys?.includes("NEVER_BOOK_SUNDAY")) {
    const [y, m, d] = input.date.split("-").map(Number);
    const utc = Date.UTC(y, m - 1, d);
    if (new Date(utc).getUTCDay() === 0) {
      return toolFailure("Company rule: Sunday appointments cannot be booked.");
    }
  }
  if (ctx.workingDays?.length && !isWorkingDate(input.date, ctx.workingDays)) {
    return toolFailure("That date is outside company working days. Offer a working day instead.");
  }
  if (!ctx.ownerId) {
    return toolFailure(
      "No salesperson owns this conversation yet, so a callback cannot be booked. Escalate instead."
    );
  }
  const resolved = await resolveRequestedInstant(ctx, input.date, input.time);
  if (!resolved.ok) return toolFailure(resolved.error);

  const availability = await getOwnerAvailability(ctx, input.date);
  if (availability.busyLocalTimes.includes(input.time)) {
    return toolFailure(
      `${ctx.ownerName ?? "The salesperson"} is unavailable at ${input.time} on ${input.date}.`,
      { alternative_times: availability.suggestedLocalTimes }
    );
  }

  const callbackIso = resolved.utc.toISOString();
  const label = formatLocalDateTime(callbackIso, ctx.timezone);

  if (ctx.testMode) {
    return toolSuccess({
      simulated: true,
      scheduled_for: label,
      purpose: input.purpose,
      owner: ctx.ownerName,
    });
  }

  const supabase = createAdminClient();
  const followUpDate = followUpDateFromCallbackAt(resolved.utc);

  const { data: callLog, error } = await supabase
    .from("call_logs")
    .insert({
      lead_id: ctx.leadId,
      user_id: ctx.ownerId,
      outcome: "FOLLOW_UP",
      reach_outcome: "call_back",
      result: null,
      callback_at: callbackIso,
      notes: `Scheduled by SegmiQ Agent — ${input.purpose}`,
      follow_up_date: followUpDate,
    })
    .select("id")
    .single();
  if (error || !callLog) {
    return toolFailure(`Could not create the appointment: ${error?.message ?? "unknown error"}`);
  }

  await supabase
    .from("leads")
    .update({ follow_up_date: followUpDate, updated_at: new Date().toISOString() })
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId);

  await logFollowUpSet({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    followUpDate,
    notes: `Callback ${label} — ${input.purpose} (scheduled by SegmiQ Agent, requested by customer on WhatsApp)`,
  });

  const { hookAppointmentCreated } = await import("@/lib/agent/proactive");
  void hookAppointmentCreated({
    clientId: ctx.clientId,
    appointmentId: callLog.id as string,
    leadId: ctx.leadId,
    callbackAt: callbackIso,
    purpose: input.purpose,
    actorType: "AGENT",
  });

  return toolSuccess(
    {
      scheduled_for: label,
      local_date: input.date,
      local_time: input.time,
      timezone: ctx.timezone,
      purpose: input.purpose,
      owner: ctx.ownerName,
    },
    { type: "callback", id: callLog.id as string }
  );
}

export async function executeRescheduleCallback(
  ctx: ToolExecutionContext,
  input: { date: string; time: string; reason?: string }
): Promise<ToolResult> {
  if (ctx.operationalRuleKeys?.includes("NEVER_BOOK_SUNDAY")) {
    const [y, m, d] = input.date.split("-").map(Number);
    const utc = Date.UTC(y, m - 1, d);
    if (new Date(utc).getUTCDay() === 0) {
      return toolFailure("Company rule: Sunday appointments cannot be booked.");
    }
  }
  const supabase = createAdminClient();
  const { data: upcoming } = await supabase
    .from("call_logs")
    .select("id, callback_at, user_id")
    .eq("lead_id", ctx.leadId)
    .gte("callback_at", new Date().toISOString())
    .not("callback_at", "is", null)
    .order("callback_at", { ascending: true })
    .limit(2);

  if (!upcoming?.length) {
    return toolFailure(
      "No upcoming appointment exists for this customer. Offer to schedule a new one instead."
    );
  }
  if (upcoming.length > 1) {
    return toolFailure(
      "The customer has more than one upcoming appointment. Ask which one they want to move.",
      {
        appointments: upcoming.map((row) =>
          formatLocalDateTime(row.callback_at as string, ctx.timezone)
        ),
      }
    );
  }

  const resolved = await resolveRequestedInstant(ctx, input.date, input.time);
  if (!resolved.ok) return toolFailure(resolved.error);

  const availability = await getOwnerAvailability(ctx, input.date);
  if (availability.busyLocalTimes.includes(input.time)) {
    return toolFailure(
      `${ctx.ownerName ?? "The salesperson"} is unavailable at ${input.time} on ${input.date}.`,
      { alternative_times: availability.suggestedLocalTimes }
    );
  }

  const previousLabel = formatLocalDateTime(upcoming[0].callback_at as string, ctx.timezone);
  const newIso = resolved.utc.toISOString();
  const newLabel = formatLocalDateTime(newIso, ctx.timezone);

  if (ctx.testMode) {
    return toolSuccess({ simulated: true, moved_from: previousLabel, moved_to: newLabel });
  }

  const followUpDate = followUpDateFromCallbackAt(resolved.utc);
  const { error } = await supabase
    .from("call_logs")
    .update({ callback_at: newIso, follow_up_date: followUpDate })
    .eq("id", upcoming[0].id as string);
  if (error) return toolFailure(`Could not reschedule: ${error.message}`);

  await supabase
    .from("leads")
    .update({ follow_up_date: followUpDate, updated_at: new Date().toISOString() })
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId);

  await logFollowUpSet({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    followUpDate,
    notes: `Rescheduled by SegmiQ Agent: ${previousLabel} → ${newLabel}${input.reason ? ` (${input.reason})` : ""}`,
  });

  const { hookAppointmentRescheduled } = await import("@/lib/agent/proactive");
  void hookAppointmentRescheduled({
    clientId: ctx.clientId,
    appointmentId: upcoming[0].id as string,
    leadId: ctx.leadId,
    callbackAt: newIso,
    actorType: "AGENT",
  });

  return toolSuccess(
    { moved_from: previousLabel, moved_to: newLabel, timezone: ctx.timezone },
    { type: "callback", id: upcoming[0].id as string }
  );
}
