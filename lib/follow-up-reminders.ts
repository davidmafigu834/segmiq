import { createAdminClient } from "@/lib/supabase/admin";
import { notifyFollowUpReminder, type FollowUpReminderKind } from "@/lib/notifications";
import { parseSalesPrefs } from "@/lib/notification-prefs";
import type { LeadRow } from "@/types";

const ACTIVE_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const;

/** How far ahead/behind callback_at we consider a lead due for a reminder. */
const CALLBACK_WINDOW_MS = {
  before: 15 * 60 * 1000,
  after: 30 * 60 * 1000,
};

type LeadWithClient = LeadRow & {
  clients?: { twilio_whatsapp_override: string | null } | null;
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
  due: FollowUpBatchResult;
  prep: FollowUpBatchResult;
  callback: FollowUpBatchResult;
  /** @deprecated Use due.whatsappSent + prep.whatsappSent + callback.whatsappSent */
  sent: number;
  /** @deprecated Use due.whatsappFailed + prep.whatsappFailed + callback.whatsappFailed */
  failed: number;
  /** @deprecated Use due.skipped + prep.skipped + callback.skipped */
  skipped: number;
  /** @deprecated Use due.totalLeads + prep.totalLeads + callback.totalLeads */
  totalLeads: number;
  dryRun?: boolean;
};

export type FollowUpPreviewLead = {
  leadId: string;
  leadName: string | null;
  followUpDate: string | null;
  callbackAt: string | null;
  kind: FollowUpReminderKind | "callback";
  batch: "due" | "prep" | "callback";
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
  counts: { due: number; prep: number; callback: number };
};

export type FollowUpRemindersOptions = {
  /** List matches only — no WhatsApp or in-app writes. */
  dryRun?: boolean;
  /** Ignore dedup (agency test). */
  force?: boolean;
  /** Limit to one lead (agency test). */
  leadId?: string;
  /** Only process callback_at window (for every-minute cron). Due/prep run on the daily job. */
  callbackOnly?: boolean;
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

function localDateParts(tz: string, now = new Date()): { y: number; mo: number; day: number; dateStr: string } {
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const [y, mo, day] = dateStr.split("-").map((n) => parseInt(n, 10));
  return { y, mo: mo - 1, day, dateStr };
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

async function fetchAlreadySentLeadIds(
  leadIds: string[],
  notificationTypes: string[],
  sinceIso: string
): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("message_logs")
    .select("lead_id")
    .in("lead_id", leadIds)
    .in("notification_type", notificationTypes)
    .eq("status", "sent")
    .eq("channel", "whatsapp")
    .gte("created_at", sinceIso);

  return new Set((rows ?? []).map((r) => r.lead_id as string));
}

async function fetchCallbackSentSince(leadId: string, sinceIso: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("message_logs")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("notification_type", "FOLLOW_UP_DUE")
    .eq("status", "sent")
    .eq("channel", "whatsapp")
    .gte("created_at", sinceIso);

  return (count ?? 0) > 0;
}

type CallbackCandidate = {
  lead: LeadWithClient;
  callbackAt: string;
};

async function fetchCallbackCandidates(leadIdFilter?: string): Promise<CallbackCandidate[]> {
  const supabase = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now - CALLBACK_WINDOW_MS.after).toISOString();
  const windowEnd = new Date(now + CALLBACK_WINDOW_MS.before).toISOString();

  let query = supabase
    .from("call_logs")
    .select(
      "id, lead_id, callback_at, created_at, leads!inner ( *, clients ( twilio_whatsapp_override ) )"
    )
    .not("callback_at", "is", null)
    .gte("callback_at", windowStart)
    .lte("callback_at", windowEnd)
    .order("created_at", { ascending: false });

  if (leadIdFilter) {
    query = query.eq("lead_id", leadIdFilter);
  }

  const { data: logs, error } = await query;
  if (error) throw new Error(`follow-up-reminders callback query: ${error.message}`);

  const seen = new Set<string>();
  const candidates: CallbackCandidate[] = [];

  for (const row of logs ?? []) {
    const lid = row.lead_id as string;
    if (seen.has(lid)) continue;
    seen.add(lid);

    const leadRaw = (row as { leads: LeadWithClient | LeadWithClient[] }).leads;
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
    if (!lead?.assigned_to_id) continue;
    if (!(ACTIVE_STATUSES as readonly string[]).includes(lead.status as string)) continue;

    candidates.push({
      lead,
      callbackAt: row.callback_at as string,
    });
  }

  return candidates;
}

async function runFollowUpBatch(opts: {
  notificationType: "FOLLOW_UP_DUE" | "FOLLOW_UP_PREP";
  resolveKind: (followUpDate: string, todayStr: string) => FollowUpReminderKind;
  inAppMessage: (leadName: string, kind: FollowUpReminderKind) => string;
  leads: LeadWithClient[];
  todayStr: string;
  startOfTodayIso: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<FollowUpBatchResult> {
  const supabase = createAdminClient();
  const results: FollowUpBatchResult = {
    totalLeads: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    skipped: 0,
    inAppCreated: 0,
  };

  const leads = opts.leads;
  results.totalLeads = leads.length;
  if (leads.length === 0) return results;

  const assigneeIds = Array.from(new Set(leads.map((l) => l.assigned_to_id as string)));
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs, is_active")
    .in("id", assigneeIds)
    .eq("is_active", true);

  const userById = Object.fromEntries((users ?? []).map((u) => [u.id as string, u]));
  const leadIds = leads.map((l) => l.id as string);

  const alreadySentIds = opts.force
    ? new Set<string>()
    : await fetchAlreadySentLeadIds(leadIds, [opts.notificationType], opts.startOfTodayIso);

  for (const lead of leads) {
    if (alreadySentIds.has(lead.id as string)) {
      results.skipped++;
      continue;
    }

    const uid = lead.assigned_to_id as string;
    const u = userById[uid];
    if (!u) {
      results.skipped++;
      continue;
    }

    const spPrefs = parseSalesPrefs((u as { notification_prefs?: unknown }).notification_prefs);
    if (!spPrefs.followUpReminders) {
      results.skipped++;
      continue;
    }

    const followUpDate = String(lead.follow_up_date ?? "");
    const kind = opts.resolveKind(followUpDate, opts.todayStr);
    const leadName = lead.name ?? "lead";

    if (opts.dryRun) {
      results.whatsappSent++;
      continue;
    }

    const salesperson = {
      id: u.id as string,
      name: u.name as string,
      phone: (u.phone as string | null) ?? null,
      email: (u.email as string | null) ?? null,
    };
    const override = lead.clients?.twilio_whatsapp_override ?? null;

    try {
      const notifyResult = await notifyFollowUpReminder(
        lead as LeadRow,
        salesperson,
        kind,
        followUpDate,
        override,
        spPrefs
      );

      if (notifyResult.ok && notifyResult.whatsappSent) {
        results.whatsappSent++;
      } else if ("skipped" in notifyResult && notifyResult.skipped) {
        results.skipped++;
        if (notifyResult.reason === "no_phone") {
          const { error: insErr } = await supabase.from("notifications").insert({
            user_id: uid,
            type: opts.notificationType,
            message: opts.inAppMessage(leadName, kind),
            read: false,
            lead_id: lead.id,
          });
          if (!insErr) results.inAppCreated++;
        }
        continue;
      } else {
        results.whatsappFailed++;
        continue;
      }

      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: uid,
        type: opts.notificationType,
        message: opts.inAppMessage(leadName, kind),
        read: false,
        lead_id: lead.id,
      });

      if (insErr) {
        console.error("[follow-up-reminders] notification insert failed", insErr);
      } else {
        results.inAppCreated++;
      }
    } catch (e) {
      console.error(`[follow-up-reminders] lead ${lead.id}:`, e);
      results.whatsappFailed++;
    }
  }

  return results;
}

async function runCallbackBatch(opts: {
  candidates: CallbackCandidate[];
  dryRun?: boolean;
  force?: boolean;
}): Promise<FollowUpBatchResult> {
  const supabase = createAdminClient();
  const results: FollowUpBatchResult = {
    totalLeads: opts.candidates.length,
    whatsappSent: 0,
    whatsappFailed: 0,
    skipped: 0,
    inAppCreated: 0,
  };

  if (opts.candidates.length === 0) return results;

  const assigneeIds = Array.from(
    new Set(opts.candidates.map((c) => c.lead.assigned_to_id as string))
  );
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

    const spPrefs = parseSalesPrefs((u as { notification_prefs?: unknown }).notification_prefs);
    if (!spPrefs.followUpReminders) {
      results.skipped++;
      continue;
    }

    if (!opts.force) {
      const dedupeSince = new Date(new Date(callbackAt).getTime() - 60 * 60 * 1000).toISOString();
      const alreadySent = await fetchCallbackSentSince(lead.id as string, dedupeSince);
      if (alreadySent) {
        results.skipped++;
        continue;
      }
    }

    const followUpDate = String(lead.follow_up_date ?? callbackAt.slice(0, 10));
    const leadName = lead.name ?? "lead";

    if (opts.dryRun) {
      results.whatsappSent++;
      continue;
    }

    const salesperson = {
      id: u.id as string,
      name: u.name as string,
      phone: (u.phone as string | null) ?? null,
      email: (u.email as string | null) ?? null,
    };
    const override = lead.clients?.twilio_whatsapp_override ?? null;

    try {
      const notifyResult = await notifyFollowUpReminder(
        lead as LeadRow,
        salesperson,
        "due",
        followUpDate,
        override,
        spPrefs
      );

      if (notifyResult.ok && notifyResult.whatsappSent) {
        results.whatsappSent++;
      } else if ("skipped" in notifyResult && notifyResult.skipped) {
        results.skipped++;
        if (notifyResult.reason === "no_phone") {
          const { error: insErr } = await supabase.from("notifications").insert({
            user_id: uid,
            type: "FOLLOW_UP_DUE",
            message: `Callback due: call ${leadName}`,
            read: false,
            lead_id: lead.id,
          });
          if (!insErr) results.inAppCreated++;
        }
        continue;
      } else {
        results.whatsappFailed++;
        continue;
      }

      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: uid,
        type: "FOLLOW_UP_DUE",
        message: `Callback due: call ${leadName}`,
        read: false,
        lead_id: lead.id,
      });

      if (!insErr) results.inAppCreated++;
    } catch (e) {
      console.error(`[follow-up-reminders] callback lead ${lead.id}:`, e);
      results.whatsappFailed++;
    }
  }

  return results;
}

function skipReasonForLead(
  lead: LeadWithClient,
  userById: Record<string, { phone?: string | null; notification_prefs?: unknown; is_active?: boolean }>,
  alreadySent: boolean,
  batch: "due" | "prep" | "callback"
): string | null {
  if (alreadySent) return `Already sent ${batch} reminder today`;
  const uid = lead.assigned_to_id as string | null;
  if (!uid) return "No assignee";
  const u = userById[uid];
  if (!u) return "Assignee inactive or missing";
  const prefs = parseSalesPrefs(u.notification_prefs);
  if (!prefs.followUpReminders) return "Follow-up reminders disabled in rep preferences";
  if (!u.phone?.trim()) return "Rep has no phone number";
  return null;
}

/**
 * Preview which leads would receive reminders (no sends).
 */
export async function previewFollowUpReminders(
  opts: FollowUpRemindersOptions = {}
): Promise<FollowUpPreviewResult> {
  const tz = getFollowUpTimezone();
  const { dateStr: todayStr } = localDateParts(tz);
  const tomorrowStr = addLocalDays(todayStr, 1);
  const startOfTodayIso = startOfLocalDayIso(tz);
  const supabase = createAdminClient();

  let dueQuery = supabase
    .from("leads")
    .select("*, clients ( twilio_whatsapp_override )")
    .lte("follow_up_date", todayStr)
    .in("status", [...ACTIVE_STATUSES])
    .not("assigned_to_id", "is", null)
    .not("follow_up_date", "is", null);

  let prepQuery = supabase
    .from("leads")
    .select("*, clients ( twilio_whatsapp_override )")
    .eq("follow_up_date", tomorrowStr)
    .in("status", [...ACTIVE_STATUSES])
    .not("assigned_to_id", "is", null);

  if (opts.leadId) {
    dueQuery = dueQuery.eq("id", opts.leadId);
    prepQuery = prepQuery.eq("id", opts.leadId);
  }

  const [{ data: dueRows }, { data: prepRows }, callbackCandidates] = await Promise.all([
    dueQuery,
    prepQuery,
    fetchCallbackCandidates(opts.leadId),
  ]);

  const dueLeads = (dueRows ?? []) as LeadWithClient[];
  const prepLeads = (prepRows ?? []) as LeadWithClient[];

  const allAssigneeIds = Array.from(
    new Set([
      ...dueLeads.map((l) => l.assigned_to_id as string),
      ...prepLeads.map((l) => l.assigned_to_id as string),
      ...callbackCandidates.map((c) => c.lead.assigned_to_id as string),
    ])
  );

  const { data: users } = await supabase
    .from("users")
    .select("id, name, phone, notification_prefs, is_active")
    .in("id", allAssigneeIds.length ? allAssigneeIds : ["00000000-0000-0000-0000-000000000000"]);

  const userById = Object.fromEntries((users ?? []).map((u) => [u.id as string, u]));

  const dueSentIds = await fetchAlreadySentLeadIds(
    dueLeads.map((l) => l.id as string),
    ["FOLLOW_UP_DUE"],
    startOfTodayIso
  );
  const prepSentIds = await fetchAlreadySentLeadIds(
    prepLeads.map((l) => l.id as string),
    ["FOLLOW_UP_PREP"],
    startOfTodayIso
  );

  const leads: FollowUpPreviewLead[] = [];

  for (const lead of dueLeads) {
    const uid = lead.assigned_to_id as string;
    const u = userById[uid];
    const followUpDate = String(lead.follow_up_date ?? "");
    const kind: FollowUpReminderKind = followUpDate < todayStr ? "overdue" : "due";
    leads.push({
      leadId: lead.id as string,
      leadName: lead.name,
      followUpDate,
      callbackAt: null,
      kind,
      batch: "due",
      assigneeId: uid,
      assigneeName: (u?.name as string | null) ?? null,
      assigneePhone: (u?.phone as string | null) ?? null,
      wouldSkipReason: skipReasonForLead(lead, userById, dueSentIds.has(lead.id as string), "due"),
    });
  }

  for (const lead of prepLeads) {
    const uid = lead.assigned_to_id as string;
    const u = userById[uid];
    leads.push({
      leadId: lead.id as string,
      leadName: lead.name,
      followUpDate: String(lead.follow_up_date ?? ""),
      callbackAt: null,
      kind: "prep",
      batch: "prep",
      assigneeId: uid,
      assigneeName: (u?.name as string | null) ?? null,
      assigneePhone: (u?.phone as string | null) ?? null,
      wouldSkipReason: skipReasonForLead(lead, userById, prepSentIds.has(lead.id as string), "prep"),
    });
  }

  for (const { lead, callbackAt } of callbackCandidates) {
    const uid = lead.assigned_to_id as string;
    const u = userById[uid];
    let wouldSkip: string | null = null;
    if (!opts.force) {
      const dedupeSince = new Date(new Date(callbackAt).getTime() - 60 * 60 * 1000).toISOString();
      const alreadySent = await fetchCallbackSentSince(lead.id as string, dedupeSince);
      if (alreadySent) wouldSkip = "Callback reminder already sent for this schedule";
    }
    if (!wouldSkip) {
      wouldSkip = skipReasonForLead(lead, userById, false, "callback");
    }
    leads.push({
      leadId: lead.id as string,
      leadName: lead.name,
      followUpDate: lead.follow_up_date,
      callbackAt,
      kind: "callback",
      batch: "callback",
      assigneeId: uid,
      assigneeName: (u?.name as string | null) ?? null,
      assigneePhone: (u?.phone as string | null) ?? null,
      wouldSkipReason: wouldSkip,
    });
  }

  return {
    timezone: tz,
    today: todayStr,
    tomorrow: tomorrowStr,
    leads,
    counts: {
      due: dueLeads.length,
      prep: prepLeads.length,
      callback: callbackCandidates.length,
    },
  };
}

/**
 * Sends WhatsApp follow-up reminders:
 * - **Due/overdue:** leads with follow_up_date on or before today (local timezone), once per day each
 * - **Prep:** leads with follow_up_date tomorrow (local), once per day each
 * - **Callback:** leads with call_logs.callback_at in the due window (every minute via `/api/cron/check-followups`)
 *
 * Pass `callbackOnly: true` to skip due/prep batches (used by the every-minute cron).
 */
export async function executeFollowUpReminders(
  opts: FollowUpRemindersOptions = {}
): Promise<FollowUpReminderResult> {
  const tz = getFollowUpTimezone();
  const { dateStr: todayStr } = localDateParts(tz);
  const tomorrowStr = addLocalDays(todayStr, 1);
  const startOfTodayIso = startOfLocalDayIso(tz);
  const batchOpts = { dryRun: opts.dryRun, force: opts.force };

  const callbackCandidates = await fetchCallbackCandidates(opts.leadId);

  let due = EMPTY_BATCH;
  let prep = EMPTY_BATCH;

  if (!opts.callbackOnly) {
    const supabase = createAdminClient();

    let dueQuery = supabase
      .from("leads")
      .select("*, clients ( twilio_whatsapp_override )")
      .lte("follow_up_date", todayStr)
      .in("status", [...ACTIVE_STATUSES])
      .not("assigned_to_id", "is", null)
      .not("follow_up_date", "is", null);

    let prepQuery = supabase
      .from("leads")
      .select("*, clients ( twilio_whatsapp_override )")
      .eq("follow_up_date", tomorrowStr)
      .in("status", [...ACTIVE_STATUSES])
      .not("assigned_to_id", "is", null);

    if (opts.leadId) {
      dueQuery = dueQuery.eq("id", opts.leadId);
      prepQuery = prepQuery.eq("id", opts.leadId);
    }

    const [{ data: dueRows, error: dueErr }, { data: prepRows, error: prepErr }] = await Promise.all([
      dueQuery,
      prepQuery,
    ]);

    if (dueErr) throw new Error(`follow-up-reminders: ${dueErr.message}`);
    if (prepErr) throw new Error(`follow-up-reminders: ${prepErr.message}`);

    due = await runFollowUpBatch({
      notificationType: "FOLLOW_UP_DUE",
      todayStr,
      startOfTodayIso,
      leads: (dueRows ?? []) as LeadWithClient[],
      resolveKind: (followUpDate, today) => (followUpDate < today ? "overdue" : "due"),
      inAppMessage: (leadName, kind) =>
        kind === "overdue" ? `Follow-up overdue: call ${leadName}` : `Follow-up due: call ${leadName}`,
      ...batchOpts,
    });

    prep = await runFollowUpBatch({
      notificationType: "FOLLOW_UP_PREP",
      todayStr,
      startOfTodayIso,
      leads: (prepRows ?? []) as LeadWithClient[],
      resolveKind: () => "prep",
      inAppMessage: (leadName) => `Follow-up tomorrow: prepare for ${leadName}`,
      ...batchOpts,
    });
  }

  const callback = await runCallbackBatch({
    candidates: callbackCandidates,
    ...batchOpts,
  });

  return {
    ok: true,
    date: startOfTodayIso,
    timezone: tz,
    due,
    prep,
    callback,
    sent: due.whatsappSent + prep.whatsappSent + callback.whatsappSent,
    failed: due.whatsappFailed + prep.whatsappFailed + callback.whatsappFailed,
    skipped: due.skipped + prep.skipped + callback.skipped,
    totalLeads: due.totalLeads + prep.totalLeads + callback.totalLeads,
    dryRun: opts.dryRun,
  };
}
