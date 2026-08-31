import { createAdminClient } from "@/lib/supabase/admin";
import { isWorkingDate, timeToMinutes } from "@/lib/sales/intelligence/operating-hours";
import { wallTimeToUtc } from "@/lib/agent/dates";

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const SLOT_MINUTES = 60;

export type BusySlot = { startIso: string; endIso: string };

export type ViewingAvailabilityResult = {
  date: string;
  timezone: string;
  agentId: string;
  agentName: string | null;
  busyLocalTimes: string[];
  suggestedLocalTimes: string[];
  workingHours: string;
};

function overlaps(startIso: string, busy: BusySlot[]): boolean {
  const start = new Date(startIso).getTime();
  const end = start + SLOT_MINUTES * 60_000;
  return busy.some((slot) => {
    const s = new Date(slot.startIso).getTime();
    const e = new Date(slot.endIso).getTime();
    return start < e && end > s;
  });
}

function toLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

async function loadAgentCallbackBusySlots(opts: {
  clientId: string;
  agentId: string;
  dayStartUtc: Date;
  dayEndUtc: Date;
}): Promise<BusySlot[]> {
  const supabase = createAdminClient();
  const { data: ownedLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("assigned_to_id", opts.agentId)
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

  return (callbacks ?? []).map((row) => {
    const start = new Date(row.callback_at as string);
    return {
      startIso: start.toISOString(),
      endIso: new Date(start.getTime() + SLOT_MINUTES * 60_000).toISOString(),
    };
  });
}

async function loadAgentViewingBusySlots(opts: {
  agentId: string;
  dayStartUtc: Date;
  dayEndUtc: Date;
}): Promise<BusySlot[]> {
  const supabase = createAdminClient();
  const { data: viewings } = await supabase
    .from("viewings")
    .select("scheduled_at")
    .eq("agent_id", opts.agentId)
    .eq("status", "scheduled")
    .gte("scheduled_at", opts.dayStartUtc.toISOString())
    .lt("scheduled_at", opts.dayEndUtc.toISOString());

  return (viewings ?? []).map((row) => {
    const start = new Date(row.scheduled_at as string);
    return {
      startIso: start.toISOString(),
      endIso: new Date(start.getTime() + SLOT_MINUTES * 60_000).toISOString(),
    };
  });
}

/** Merge callbacks + scheduled viewings for the routed viewing agent. */
export async function getViewingAgentAvailability(opts: {
  clientId: string;
  agentId: string;
  agentName: string | null;
  timezone: string;
  localDate: string;
  workingDays?: number[];
  workStartTime?: string;
  workEndTime?: string;
}): Promise<ViewingAvailabilityResult | { ok: false; error: string }> {
  if (opts.workingDays?.length && !isWorkingDate(opts.localDate, opts.workingDays)) {
    return {
      ok: false,
      error: "That date is outside company working days. Offer a working day instead.",
    };
  }

  const [y, m, d] = opts.localDate.split("-").map(Number);
  const dayStartUtc = wallTimeToUtc(opts.timezone, y, m, d, 0, 0);
  const dayEndUtc = wallTimeToUtc(opts.timezone, y, m, d, 23, 59);

  const [callbacks, viewings] = await Promise.all([
    loadAgentCallbackBusySlots({
      clientId: opts.clientId,
      agentId: opts.agentId,
      dayStartUtc,
      dayEndUtc,
    }),
    loadAgentViewingBusySlots({ agentId: opts.agentId, dayStartUtc, dayEndUtc }),
  ]);

  const busy = [...callbacks, ...viewings].sort((a, b) => a.startIso.localeCompare(b.startIso));
  const busyLocalTimes = [...new Set(busy.map((slot) => toLocalTime(slot.startIso, opts.timezone)))];

  const workStart = opts.workStartTime ? timeToMinutes(opts.workStartTime) : WORK_START_HOUR * 60;
  const workEnd = opts.workEndTime ? timeToMinutes(opts.workEndTime) : WORK_END_HOUR * 60;
  const startHour = Math.floor(workStart / 60);
  const endHour = Math.max(startHour + 1, Math.ceil(workEnd / 60));

  const suggestions: string[] = [];
  const now = Date.now();
  for (let hour = startHour; hour < endHour && suggestions.length < 4; hour++) {
    const slotUtc = wallTimeToUtc(opts.timezone, y, m, d, hour, 0);
    if (slotUtc.getTime() <= now) continue;
    if (!overlaps(slotUtc.toISOString(), busy)) {
      suggestions.push(`${String(hour).padStart(2, "0")}:00`);
    }
  }

  const workStartLabel = opts.workStartTime ?? `${String(WORK_START_HOUR).padStart(2, "0")}:00`;
  const workEndLabel = opts.workEndTime ?? `${String(WORK_END_HOUR).padStart(2, "0")}:00`;

  return {
    date: opts.localDate,
    timezone: opts.timezone,
    agentId: opts.agentId,
    agentName: opts.agentName,
    busyLocalTimes,
    suggestedLocalTimes: suggestions,
    workingHours: `${workStartLabel}-${workEndLabel}`,
  };
}

export function mergeBusyLocalTimes(callbackTimes: string[], viewingTimes: string[]): string[] {
  return [...new Set([...callbackTimes, ...viewingTimes])].sort();
}
