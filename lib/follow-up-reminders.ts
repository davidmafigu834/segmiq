import { createAdminClient } from "@/lib/supabase/admin";
import { parseSalesPrefs } from "@/lib/notification-prefs";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import { getPublicBaseUrl, magicLinkUrl } from "@/lib/constants";
import type { LeadRow } from "@/types";

const ACTIVE_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const;

/** Catch the T-30 mark once with the every-minute cron (28–32 minutes before). */
const T30_WINDOW_MS = {
  minUntil: 28 * 60 * 1000,
  maxUntil: 32 * 60 * 1000,
};

type LeadWithClient = LeadRow & {
  clients?: { name?: string | null; twilio_whatsapp_override?: string | null } | null;
};

export type FollowUpBatchResult = {
  totalLeads: number;
  whatsappSent: number;
  whatsappFailed: number;
  skipped: number;
  inAppCreated: number;
};

export type FollowUpReminderResult = {
  ok: boolean;
  date: string;
  timezone: string;
  morning: FollowUpBatchResult;
  t30Rep: FollowUpBatchResult;
  t30Lead: FollowUpBatchResult;
  /** @deprecated alias of morning */
  due: FollowUpBatchResult;
  /** @deprecated unused — empty */
  prep: FollowUpBatchResult;
  /** @deprecated alias of t30Rep */
  callback: FollowUpBatchResult;
  sent: number;
  failed: number;
  skipped: number;
  totalLeads: number;
  dryRun?: boolean;
};

export type FollowUpPreviewLead = {
  leadId: string;
  leadName: string | null;
  followUpDate: string | null;
  callbackAt: string | null;
  kind: "morning" | "t30_rep" | "t30_lead";
  batch: "morning" | "t30_rep" | "t30_lead";
  assigneeId: string;
  assigneeName: string | null;
  assigneePhone: string | null;
  wouldSkipReason: string | null;
};

export type FollowUpPreviewResult = {
  timezone: string;
  today: string;
  tomorrow: string;
  leads: FollowUpPreviewLead[];
  counts: { morning: number; t30Rep: number; t30Lead: number; due: number; prep: number; callback: number };
};

export type FollowUpRemindersOptions = {
  dryRun?: boolean;
  force?: boolean;
  leadId?: string;
  /** Every-minute cron: only T-30 reminders. Daily cron runs morning digest. */
  t30Only?: boolean;
  /** @deprecated use t30Only */
  callbackOnly?: boolean;
  morningOnly?: boolean;
};

const EMPTY_BATCH: FollowUpBatchResult = {
  totalLeads: 0,
  whatsappSent: 0,
  whatsappFailed: 0,
  skipped: 0,
  inAppCreated: 0,
};

export function getFollowUpTimezone(): string {
  return process.env.DEFAULT_TIMEZONE?.trim() || "Africa/Harare";
}

function localDateParts(tz: string, now = new Date()): { dateStr: string } {
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  return { dateStr };
}

function addLocalDays(dateStr: string, delta: number): string {
  const [y, mo, day] = dateStr.split("-").map((n) => parseInt(n, 10));
  const d = new Date(Date.UTC(y, mo - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function startOfLocalDayIso(tz: string, now = new Date()): string {
  const { dateStr } = localDateParts(tz, now);
  const probe = new Date(`${dateStr}T12:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const [hour, minute, second] = fmt.format(probe).split(":").map((n) => parseInt(n, 10));
  const msIntoDay = ((hour * 60 + minute) * 60 + second) * 1000;
  return new Date(probe.getTime() - msIntoDay).toISOString();
}

function endOfLocalDayIso(tz: string, now = new Date()): string {
  const start = new Date(startOfLocalDayIso(tz, now)).getTime();
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}

function formatLocalTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Returns true if this process owns the send. */
async function claimReminderSend(claimKey: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("reminder_send_claims").insert({ claim_key: claimKey });

  if (!error) return true;
  if (error.code === "23505") return false;

  // Fallback if 085 not applied — allow send (message_logs + narrow T-30 window limit spam)
  if (error.message?.includes("reminder_send_claims") || error.message?.includes("does not exist")) {
    console.warn("[follow-up-reminders] reminder_send_claims missing; apply migration 085");
    return true;
  }

  console.error("[follow-up-reminders] claim failed", error);
  return false;
}

type ScheduledFollowUp = {
  lead: LeadWithClient;
  callbackAt: string | null;
  timeLabel: string;
};

async function fetchTodaysFollowUps(
  tz: string,
  todayStr: string,
  leadIdFilter?: string
): Promise<ScheduledFollowUp[]> {
  const supabase = createAdminClient();
  const dayStart = startOfLocalDayIso(tz);
  const dayEnd = endOfLocalDayIso(tz);

  let byDateQuery = supabase
    .from("leads")
    .select("*, clients ( name, twilio_whatsapp_override )")
    .eq("follow_up_date", todayStr)
    .in("status", [...ACTIVE_STATUSES])
    .not("assigned_to_id", "is", null);

  if (leadIdFilter) byDateQuery = byDateQuery.eq("id", leadIdFilter);

  let callbackQuery = supabase
    .from("call_logs")
    .select(
      "id, lead_id, callback_at, created_at, leads!inner ( *, clients ( name, twilio_whatsapp_override ) )"
    )
    .not("callback_at", "is", null)
    .gte("callback_at", dayStart)
    .lt("callback_at", dayEnd)
    .order("created_at", { ascending: false });

  if (leadIdFilter) callbackQuery = callbackQuery.eq("lead_id", leadIdFilter);

  const [{ data: byDateRows }, { data: callbackRows, error: cbErr }] = await Promise.all([
    byDateQuery,
    callbackQuery,
  ]);

  if (cbErr) throw new Error(`follow-up today callbacks: ${cbErr.message}`);

  const byLead = new Map<string, ScheduledFollowUp>();

  for (const row of callbackRows ?? []) {
    const lid = row.lead_id as string;
    if (byLead.has(lid)) continue;
    const leadRaw = (row as { leads: LeadWithClient | LeadWithClient[] }).leads;
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
    if (!lead?.assigned_to_id) continue;
    if (!(ACTIVE_STATUSES as readonly string[]).includes(lead.status as string)) continue;
    const callbackAt = row.callback_at as string;
    byLead.set(lid, {
      lead,
      callbackAt,
      timeLabel: formatLocalTime(callbackAt, tz),
    });
  }

  for (const lead of (byDateRows ?? []) as LeadWithClient[]) {
    const lid = lead.id as string;
    if (byLead.has(lid)) continue;
    byLead.set(lid, {
      lead,
      callbackAt: null,
      timeLabel: "time TBD",
    });
  }

  return Array.from(byLead.values()).sort((a, b) => {
    const at = a.callbackAt ? new Date(a.callbackAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.callbackAt ? new Date(b.callbackAt).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });
}

async function fetchT30Candidates(leadIdFilter?: string): Promise<
  { lead: LeadWithClient; callbackAt: string }[]
> {
  const supabase = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + T30_WINDOW_MS.minUntil).toISOString();
  const windowEnd = new Date(now + T30_WINDOW_MS.maxUntil).toISOString();

  let query = supabase
    .from("call_logs")
    .select(
      "id, lead_id, callback_at, created_at, leads!inner ( *, clients ( name, twilio_whatsapp_override ) )"
    )
    .not("callback_at", "is", null)
    .gte("callback_at", windowStart)
    .lte("callback_at", windowEnd)
    .order("created_at", { ascending: false });

  if (leadIdFilter) query = query.eq("lead_id", leadIdFilter);

  const { data: logs, error } = await query;
  if (error) throw new Error(`follow-up T-30 query: ${error.message}`);

  const seen = new Set<string>();
  const out: { lead: LeadWithClient; callbackAt: string }[] = [];

  for (const row of logs ?? []) {
    const lid = row.lead_id as string;
    if (seen.has(lid)) continue;
    seen.add(lid);
    const leadRaw = (row as { leads: LeadWithClient | LeadWithClient[] }).leads;
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
    if (!lead?.assigned_to_id) continue;
    if (!(ACTIVE_STATUSES as readonly string[]).includes(lead.status as string)) continue;
    out.push({ lead, callbackAt: row.callback_at as string });
  }

  return out;
}

async function runMorningDigest(opts: {
  items: ScheduledFollowUp[];
  todayStr: string;
  tz: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<FollowUpBatchResult> {
  const results: FollowUpBatchResult = { ...EMPTY_BATCH };
  const byAssignee = new Map<string, ScheduledFollowUp[]>();

  for (const item of opts.items) {
    const uid = item.lead.assigned_to_id as string;
    if (!byAssignee.has(uid)) byAssignee.set(uid, []);
    byAssignee.get(uid)!.push(item);
  }

  results.totalLeads = opts.items.length;
  if (byAssignee.size === 0) return results;

  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs, is_active")
    .in("id", Array.from(byAssignee.keys()))
    .eq("is_active", true);

  const userById = Object.fromEntries((users ?? []).map((u) => [u.id as string, u]));

  for (const [uid, items] of byAssignee) {
    const u = userById[uid];
    if (!u) {
      results.skipped += items.length;
      continue;
    }
    const prefs = parseSalesPrefs((u as { notification_prefs?: unknown }).notification_prefs);
    if (!prefs.followUpReminders) {
      results.skipped += items.length;
      continue;
    }
    if (!opts.force && !opts.dryRun) {
      const claimed = await claimReminderSend(`morning:${uid}:${opts.todayStr}`);
      if (!claimed) {
        results.skipped += items.length;
        continue;
      }
    }

    if (opts.dryRun) {
      results.whatsappSent++;
      continue;
    }

    const lines = items
      .slice(0, 8)
      .map((i) => `${i.lead.name ?? "Lead"} at ${i.timeLabel}`)
      .join("; ");
    const extra = items.length > 8 ? ` (+${items.length - 8} more)` : "";
    const scheduleText = `${items.length} follow-up(s) today: ${lines}${extra}`;
    const followUpsUrl = `${getPublicBaseUrl()}/sales/followups`;
    const firstLead = items[0]!.lead;
    const override = firstLead.clients?.twilio_whatsapp_override ?? null;

    try {
      const r = await sendWhatsApp({
        to: (u.phone as string | null) ?? null,
        toOverride: override,
        template: "FOLLOW_UP_REMINDER",
        variables: {
          "1": firstName(u.name as string),
          "2": `${items.length} meeting(s)`,
          "3": scheduleText,
          "4": followUpsUrl,
        },
        fallbackBody: `Good morning ${firstName(u.name as string)}. ${scheduleText}`,
        context: {
          userId: uid,
          leadId: firstLead.id,
          clientId: firstLead.client_id,
          notificationType: "FOLLOW_UP_DUE",
        },
      });

      if (r.ok) {
        results.whatsappSent++;
        await supabase.from("notifications").insert({
          user_id: uid,
          type: "FOLLOW_UP_DUE",
          message: `Today: ${scheduleText}`,
          read: false,
          lead_id: firstLead.id,
        });
        results.inAppCreated++;
      } else {
        results.whatsappFailed++;
        console.error("[follow-up-reminders] morning digest failed", r.error, { userId: uid });
      }
    } catch (e) {
      results.whatsappFailed++;
      console.error("[follow-up-reminders] morning digest", e);
    }
  }

  return results;
}

async function runT30Rep(opts: {
  candidates: { lead: LeadWithClient; callbackAt: string }[];
  tz: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<FollowUpBatchResult> {
  const results: FollowUpBatchResult = {
    totalLeads: opts.candidates.length,
    whatsappSent: 0,
    whatsappFailed: 0,
    skipped: 0,
    inAppCreated: 0,
  };
  if (opts.candidates.length === 0) return results;

  const supabase = createAdminClient();
  const assigneeIds = Array.from(new Set(opts.candidates.map((c) => c.lead.assigned_to_id as string)));
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs, is_active")
    .in("id", assigneeIds)
    .eq("is_active", true);
  const userById = Object.fromEntries((users ?? []).map((u) => [u.id as string, u]));

  for (const { lead, callbackAt } of opts.candidates) {
    const uid = lead.assigned_to_id as string;
    const u = userById[uid];
    if (!u) {
      results.skipped++;
      continue;
    }
    const prefs = parseSalesPrefs((u as { notification_prefs?: unknown }).notification_prefs);
    if (!prefs.followUpReminders) {
      results.skipped++;
      continue;
    }

    if (!opts.force && !opts.dryRun) {
      const claimed = await claimReminderSend(`t30_rep:${lead.id}:${callbackAt}`);
      if (!claimed) {
        results.skipped++;
        continue;
      }
    }

    if (opts.dryRun) {
      results.whatsappSent++;
      continue;
    }

    const timeLabel = formatLocalTime(callbackAt, opts.tz);
    const override = lead.clients?.twilio_whatsapp_override ?? null;
    const magicToken = lead.magic_token ?? "";
    const leadLink = magicToken ? magicLinkUrl(magicToken) : getPublicBaseUrl();

    try {
      const r = await sendWhatsApp({
        to: (u.phone as string | null) ?? null,
        toOverride: override,
        template: "FOLLOW_UP_REMINDER",
        variables: {
          "1": firstName(u.name as string),
          "2": lead.name || "lead",
          "3": `Meeting in 30 minutes (at ${timeLabel}).`,
          "4": leadLink,
        },
        fallbackBody: `${firstName(u.name as string)}, meeting with ${lead.name ?? "lead"} in 30 minutes (${timeLabel}).`,
        context: {
          userId: uid,
          leadId: lead.id,
          clientId: lead.client_id,
          notificationType: "FOLLOW_UP_DUE",
        },
      });

      if (r.ok) {
        results.whatsappSent++;
        await supabase.from("notifications").insert({
          user_id: uid,
          type: "FOLLOW_UP_DUE",
          message: `In 30 min (${timeLabel}): call ${lead.name ?? "lead"}`,
          read: false,
          lead_id: lead.id,
        });
        results.inAppCreated++;
      } else if (r.errorCode === "SKIPPED_NO_PHONE") {
        results.skipped++;
      } else {
        results.whatsappFailed++;
      }
    } catch (e) {
      results.whatsappFailed++;
      console.error(`[follow-up-reminders] t30_rep ${lead.id}:`, e);
    }
  }

  return results;
}

async function runT30Lead(opts: {
  candidates: { lead: LeadWithClient; callbackAt: string }[];
  tz: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<FollowUpBatchResult> {
  const results: FollowUpBatchResult = {
    totalLeads: opts.candidates.length,
    whatsappSent: 0,
    whatsappFailed: 0,
    skipped: 0,
    inAppCreated: 0,
  };
  if (opts.candidates.length === 0) return results;

  const supabase = createAdminClient();

  for (const { lead, callbackAt } of opts.candidates) {
    if (!lead.phone?.trim()) {
      results.skipped++;
      continue;
    }

    if (!opts.force && !opts.dryRun) {
      const claimed = await claimReminderSend(`t30_lead:${lead.id}:${callbackAt}`);
      if (!claimed) {
        results.skipped++;
        continue;
      }
    }

    if (opts.dryRun) {
      results.whatsappSent++;
      continue;
    }

    const timeLabel = formatLocalTime(callbackAt, opts.tz);
    const company = (lead.clients?.name as string | null)?.trim() || "us";
    let repLabel = company;
    if (lead.assigned_to_id) {
      const { data: rep } = await supabase
        .from("users")
        .select("name")
        .eq("id", lead.assigned_to_id)
        .maybeSingle();
      const repName = (rep?.name as string | null)?.trim();
      if (repName) repLabel = `${firstName(repName)} at ${company}`;
    }

    const prospectFirst = firstName(lead.name);
    const body = `Reminder: we have a meeting at ${timeLabel} today. Looking forward to speaking with you.`;
    const magicToken = lead.magic_token ?? "";
    const leadLink = magicToken ? magicLinkUrl(magicToken) : getPublicBaseUrl();

    try {
      const r = await sendWhatsApp({
        to: lead.phone,
        toOverride: lead.clients?.twilio_whatsapp_override ?? null,
        template: "SEND_CUSTOM_MESSAGE",
        variables: {
          "1": prospectFirst,
          "2": repLabel,
          "3": body,
        },
        fallbackBody: `Hi ${prospectFirst}, a quick note from ${repLabel}: ${body}`,
        context: {
          userId: lead.assigned_to_id,
          leadId: lead.id,
          clientId: lead.client_id,
          notificationType: "FOLLOW_UP_PREP",
        },
      });

      if (r.ok) {
        results.whatsappSent++;
      } else {
        results.whatsappFailed++;
        console.error("[follow-up-reminders] t30_lead failed", r.error, { leadId: lead.id, leadLink });
      }
    } catch (e) {
      results.whatsappFailed++;
      console.error(`[follow-up-reminders] t30_lead ${lead.id}:`, e);
    }
  }

  return results;
}

/**
 * Preview which reminders would fire (no sends).
 */
export async function previewFollowUpReminders(
  opts: FollowUpRemindersOptions = {}
): Promise<FollowUpPreviewResult> {
  const tz = getFollowUpTimezone();
  const { dateStr: todayStr } = localDateParts(tz);
  const tomorrowStr = addLocalDays(todayStr, 1);

  const [todayItems, t30] = await Promise.all([
    fetchTodaysFollowUps(tz, todayStr, opts.leadId),
    fetchT30Candidates(opts.leadId),
  ]);

  const supabase = createAdminClient();
  const assigneeIds = Array.from(
    new Set([
      ...todayItems.map((i) => i.lead.assigned_to_id as string),
      ...t30.map((c) => c.lead.assigned_to_id as string),
    ])
  );
  const { data: users } = await supabase
    .from("users")
    .select("id, name, phone, notification_prefs, is_active")
    .in("id", assigneeIds.length ? assigneeIds : ["00000000-0000-0000-0000-000000000000"]);
  const userById = Object.fromEntries((users ?? []).map((u) => [u.id as string, u]));

  const leads: FollowUpPreviewLead[] = [];

  // One preview row per assignee for morning digest
  const morningAssignees = new Map<string, ScheduledFollowUp[]>();
  for (const item of todayItems) {
    const uid = item.lead.assigned_to_id as string;
    if (!morningAssignees.has(uid)) morningAssignees.set(uid, []);
    morningAssignees.get(uid)!.push(item);
  }
  for (const [uid, items] of morningAssignees) {
    const u = userById[uid];
    const prefs = parseSalesPrefs(u?.notification_prefs);
    let skip: string | null = null;
    if (!u) skip = "Assignee inactive or missing";
    else if (!prefs.followUpReminders) skip = "Follow-up reminders disabled";
    else if (!u.phone?.trim()) skip = "Rep has no phone number";
    leads.push({
      leadId: items[0]!.lead.id as string,
      leadName: `${items.length} follow-up(s)`,
      followUpDate: todayStr,
      callbackAt: null,
      kind: "morning",
      batch: "morning",
      assigneeId: uid,
      assigneeName: (u?.name as string | null) ?? null,
      assigneePhone: (u?.phone as string | null) ?? null,
      wouldSkipReason: skip,
    });
  }

  for (const { lead, callbackAt } of t30) {
    const uid = lead.assigned_to_id as string;
    const u = userById[uid];
    const prefs = parseSalesPrefs(u?.notification_prefs);
    let skipRep: string | null = null;
    if (!u) skipRep = "Assignee inactive or missing";
    else if (!prefs.followUpReminders) skipRep = "Follow-up reminders disabled";
    else if (!u.phone?.trim()) skipRep = "Rep has no phone number";

    leads.push({
      leadId: lead.id as string,
      leadName: lead.name,
      followUpDate: lead.follow_up_date,
      callbackAt,
      kind: "t30_rep",
      batch: "t30_rep",
      assigneeId: uid,
      assigneeName: (u?.name as string | null) ?? null,
      assigneePhone: (u?.phone as string | null) ?? null,
      wouldSkipReason: skipRep,
    });

    leads.push({
      leadId: lead.id as string,
      leadName: lead.name,
      followUpDate: lead.follow_up_date,
      callbackAt,
      kind: "t30_lead",
      batch: "t30_lead",
      assigneeId: uid,
      assigneeName: (u?.name as string | null) ?? null,
      assigneePhone: lead.phone,
      wouldSkipReason: lead.phone?.trim() ? null : "Lead has no phone number",
    });
  }

  return {
    timezone: tz,
    today: todayStr,
    tomorrow: tomorrowStr,
    leads,
    counts: {
      morning: morningAssignees.size,
      t30Rep: t30.length,
      t30Lead: t30.length,
      due: morningAssignees.size,
      prep: 0,
      callback: t30.length,
    },
  };
}

/**
 * Follow-up WhatsApp schedule:
 * - **Morning (daily 06:00):** one digest per rep listing today's follow-ups
 * - **T-30 (every minute):** once to the rep and once to the lead, ~30 minutes before callback_at
 */
export async function executeFollowUpReminders(
  opts: FollowUpRemindersOptions = {}
): Promise<FollowUpReminderResult> {
  const tz = getFollowUpTimezone();
  const { dateStr: todayStr } = localDateParts(tz);
  const startOfTodayIso = startOfLocalDayIso(tz);
  const t30Only = opts.t30Only ?? opts.callbackOnly ?? false;
  const morningOnly = opts.morningOnly ?? false;

  let morning = EMPTY_BATCH;
  let t30Rep = EMPTY_BATCH;
  let t30Lead = EMPTY_BATCH;

  if (!t30Only) {
    const todayItems = await fetchTodaysFollowUps(tz, todayStr, opts.leadId);
    morning = await runMorningDigest({
      items: todayItems,
      todayStr,
      tz,
      dryRun: opts.dryRun,
      force: opts.force,
    });
  }

  if (!morningOnly) {
    const t30 = await fetchT30Candidates(opts.leadId);
    t30Rep = await runT30Rep({
      candidates: t30,
      tz,
      dryRun: opts.dryRun,
      force: opts.force,
    });
    t30Lead = await runT30Lead({
      candidates: t30,
      tz,
      dryRun: opts.dryRun,
      force: opts.force,
    });
  }

  return {
    ok: true,
    date: startOfTodayIso,
    timezone: tz,
    morning,
    t30Rep,
    t30Lead,
    due: morning,
    prep: EMPTY_BATCH,
    callback: t30Rep,
    sent: morning.whatsappSent + t30Rep.whatsappSent + t30Lead.whatsappSent,
    failed: morning.whatsappFailed + t30Rep.whatsappFailed + t30Lead.whatsappFailed,
    skipped: morning.skipped + t30Rep.skipped + t30Lead.skipped,
    totalLeads: morning.totalLeads + t30Rep.totalLeads + t30Lead.totalLeads,
    dryRun: opts.dryRun,
  };
}
