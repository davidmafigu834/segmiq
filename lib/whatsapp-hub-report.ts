import { createAdminClient } from "@/lib/supabase/admin";
import { SCORE_HOT_MIN, SCORE_WARM_MIN } from "@/lib/inbox/scoring";
import { addDays, format, startOfDay, subDays } from "date-fns";

const TERMINAL = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

export type WhatsAppHubPeriod = "this_week" | "this_month";

export type WhatsAppHubRepRow = {
  userId: string;
  name: string;
  outboundMessages: number;
  assignedChats: number;
  contactedChats: number;
};

export type WhatsAppHubDailyVolume = {
  date: string;
  label: string;
  inbound: number;
  outbound: number;
};

export type WhatsAppHubReport = {
  period: { id: WhatsAppHubPeriod; from: string; to: string; label: string };
  summary: {
    activeChats: number;
    newChats: number;
    newChatsPrior: number;
    inboundMessages: number;
    outboundMessages: number;
    unassignedChats: number;
    awaitingReply: number;
    hotChats: number;
    warmChats: number;
    coldChats: number;
    contactedChats: number;
    avgFirstResponseMinutes: number | null;
  };
  byRep: WhatsAppHubRepRow[];
  dailyVolume: WhatsAppHubDailyVolume[];
};

type WaLeadRow = {
  id: string;
  assigned_to_id: string | null;
  status: string;
  score: number | null;
  created_at: string;
};

type WaMessageRow = {
  lead_id: string;
  direction: string;
  actor_id: string | null;
  created_at: string;
};

function periodRange(id: WhatsAppHubPeriod, now = new Date()): {
  from: Date;
  to: Date;
  priorFrom: Date;
  priorTo: Date;
  label: string;
} {
  const to = addDays(startOfDay(now), 1);
  if (id === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const ms = to.getTime() - from.getTime();
    return {
      from,
      to,
      priorFrom: new Date(from.getTime() - ms),
      priorTo: from,
      label: format(from, "MMMM yyyy"),
    };
  }
  const from = subDays(to, 7);
  const priorTo = from;
  const priorFrom = subDays(priorTo, 7);
  return { from, to, priorFrom, priorTo, label: "Last 7 days" };
}

function pctDelta(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prior) / prior) * 100);
}

export function whatsappHubDeltaPct(report: WhatsAppHubReport): number | null {
  return pctDelta(report.summary.newChats, report.summary.newChatsPrior);
}

function averageFirstResponseMinutes(
  messages: WaMessageRow[],
  leadIds: Set<string>
): number | null {
  const byLead = new Map<string, WaMessageRow[]>();
  for (const row of messages) {
    if (!leadIds.has(row.lead_id)) continue;
    const list = byLead.get(row.lead_id) ?? [];
    list.push(row);
    byLead.set(row.lead_id, list);
  }

  const samples: number[] = [];
  for (const rows of Array.from(byLead.values())) {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const firstInbound = sorted.find((r) => r.direction === "inbound");
    if (!firstInbound) continue;
    const firstOutbound = sorted.find(
      (r) =>
        r.direction === "outbound"
        && new Date(r.created_at).getTime() > new Date(firstInbound.created_at).getTime()
    );
    if (!firstOutbound) continue;
    const mins = Math.round(
      (new Date(firstOutbound.created_at).getTime()
        - new Date(firstInbound.created_at).getTime())
        / 60_000
    );
    if (mins >= 0 && mins < 7 * 24 * 60) samples.push(mins);
  }

  if (!samples.length) return null;
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

function countAwaitingReply(messages: WaMessageRow[], activeLeadIds: Set<string>): number {
  const latest = new Map<string, WaMessageRow>();
  for (const row of messages) {
    if (!activeLeadIds.has(row.lead_id)) continue;
    const prev = latest.get(row.lead_id);
    if (!prev || new Date(row.created_at) > new Date(prev.created_at)) {
      latest.set(row.lead_id, row);
    }
  }
  let count = 0;
  for (const row of Array.from(latest.values())) {
    if (row.direction === "inbound") count++;
  }
  return count;
}

export async function computeWhatsAppHubReport(opts: {
  clientId: string;
  period?: WhatsAppHubPeriod;
  salespersonId?: string | null;
  now?: Date;
  from?: Date;
  to?: Date;
}): Promise<WhatsAppHubReport> {
  const supabase = createAdminClient();
  const now = opts.now ?? new Date();
  const periodId = opts.period ?? "this_week";
  const preset = periodRange(periodId, now);
  const from = opts.from ?? preset.from;
  const to = opts.to ?? preset.to;
  const ms = Math.max(0, to.getTime() - from.getTime());
  const range = {
    from,
    to,
    priorFrom: opts.from ? new Date(from.getTime() - ms) : preset.priorFrom,
    priorTo: opts.from ? from : preset.priorTo,
    label: opts.from ? `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}` : preset.label,
  };
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const [{ data: leads, error: leadsError }, { data: messages }, { data: reps }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, assigned_to_id, status, score, created_at")
      .eq("client_id", opts.clientId)
      .eq("source", "WHATSAPP_INBOUND")
      .or("is_archived.is.null,is_archived.eq.false"),
    supabase
      .from("whatsapp_messages")
      .select("lead_id, direction, actor_id, created_at")
      .eq("client_id", opts.clientId)
      .gte("created_at", range.priorFrom.toISOString())
      .lt("created_at", toIso),
    supabase
      .from("users")
      .select("id, name")
      .eq("client_id", opts.clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true),
  ]);

  let waLeads = (leads ?? []) as WaLeadRow[];
  if (leadsError && String(leadsError.message).includes("is_archived")) {
    const { data: retryLeads } = await supabase
      .from("leads")
      .select("id, assigned_to_id, status, score, created_at")
      .eq("client_id", opts.clientId)
      .eq("source", "WHATSAPP_INBOUND");
    waLeads = (retryLeads ?? []) as WaLeadRow[];
  }

  const allMessages = (messages ?? []) as WaMessageRow[];
  const repRows = (reps ?? []) as { id: string; name: string }[];

  const scopedLeads = opts.salespersonId
    ? waLeads.filter((l) => l.assigned_to_id === opts.salespersonId)
    : waLeads;

  const activeLeads = scopedLeads.filter((l) => !TERMINAL.has(l.status));
  const activeLeadIds = new Set(activeLeads.map((l) => l.id));

  const periodMessages = allMessages.filter((m) => {
    const t = new Date(m.created_at).getTime();
    return t >= range.from.getTime() && t < range.to.getTime();
  });

  const scopedPeriodMessages = opts.salespersonId
    ? periodMessages.filter(
        (m) => m.actor_id === opts.salespersonId || activeLeadIds.has(m.lead_id)
      )
    : periodMessages;

  const inboundMessages = scopedPeriodMessages.filter((m) => m.direction === "inbound").length;
  const outboundMessages = scopedPeriodMessages.filter((m) => m.direction === "outbound").length;

  const newChats = scopedLeads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t >= range.from.getTime() && t < range.to.getTime();
  }).length;

  const newChatsPrior = scopedLeads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t >= range.priorFrom.getTime() && t < range.priorTo.getTime();
  }).length;

  const byRepMap = new Map<string, WhatsAppHubRepRow>();

  for (const rep of repRows) {
    byRepMap.set(rep.id, {
      userId: rep.id,
      name: rep.name,
      outboundMessages: 0,
      assignedChats: 0,
      contactedChats: 0,
    });
  }

  for (const lead of activeLeads) {
    if (!lead.assigned_to_id) continue;
    const row = byRepMap.get(lead.assigned_to_id);
    if (!row) continue;
    row.assignedChats++;
    if (lead.status !== "NEW") row.contactedChats++;
  }

  for (const msg of scopedPeriodMessages) {
    if (msg.direction !== "outbound" || !msg.actor_id) continue;
    const row = byRepMap.get(msg.actor_id);
    if (row) row.outboundMessages++;
  }

  const dailyVolume: WhatsAppHubDailyVolume[] = [];
  const dayCount = Math.min(
    31,
    Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000))
  );
  for (let i = dayCount - 1; i >= 0; i--) {
    const dayStart = subDays(range.to, i + 1);
    const dayEnd = subDays(range.to, i);
    const inbound = scopedPeriodMessages.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return m.direction === "inbound" && t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    const outbound = scopedPeriodMessages.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return m.direction === "outbound" && t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    dailyVolume.push({
      date: format(dayStart, "yyyy-MM-dd"),
      label: format(dayStart, "EEE d"),
      inbound,
      outbound,
    });
  }

  const hotChats = activeLeads.filter((l) => (l.score ?? 0) >= SCORE_HOT_MIN).length;
  const warmChats = activeLeads.filter((l) => {
    const s = l.score ?? 0;
    return s >= SCORE_WARM_MIN && s < SCORE_HOT_MIN;
  }).length;
  const coldChats = activeLeads.filter((l) => (l.score ?? 0) < SCORE_WARM_MIN).length;

  return {
    period: {
      id: periodId,
      from: fromIso,
      to: toIso,
      label: range.label,
    },
    summary: {
      activeChats: activeLeads.length,
      newChats,
      newChatsPrior,
      inboundMessages,
      outboundMessages,
      unassignedChats: activeLeads.filter((l) => !l.assigned_to_id).length,
      awaitingReply: countAwaitingReply(allMessages, activeLeadIds),
      hotChats,
      warmChats,
      coldChats,
      contactedChats: activeLeads.filter((l) => l.status !== "NEW").length,
      avgFirstResponseMinutes: averageFirstResponseMinutes(periodMessages, activeLeadIds),
    },
    byRep: Array.from(byRepMap.values())
      .filter((r) => !opts.salespersonId || r.userId === opts.salespersonId)
      .sort((a, b) => b.outboundMessages - a.outboundMessages),
    dailyVolume,
  };
}
