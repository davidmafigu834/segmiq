import { createAdminClient } from "@/lib/supabase/admin";
import { notifyFollowUpReminder, type FollowUpReminderKind } from "@/lib/notifications";
import { parseSalesPrefs } from "@/lib/notification-prefs";
import type { LeadRow } from "@/types";

const ACTIVE_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const;

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
  due: FollowUpBatchResult;
  prep: FollowUpBatchResult;
  /** @deprecated Use due.whatsappSent + prep.whatsappSent */
  sent: number;
  /** @deprecated Use due.whatsappFailed + prep.whatsappFailed */
  failed: number;
  /** @deprecated Use due.skipped + prep.skipped */
  skipped: number;
  /** @deprecated Use due.totalLeads + prep.totalLeads */
  totalLeads: number;
};

function utcTodayParts(now = new Date()) {
  return { y: now.getUTCFullYear(), mo: now.getUTCMonth(), day: now.getUTCDate() };
}

function utcDateString(y: number, mo: number, day: number): string {
  return new Date(Date.UTC(y, mo, day)).toISOString().slice(0, 10);
}

function addUtcDays(y: number, mo: number, day: number, delta: number) {
  const d = new Date(Date.UTC(y, mo, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return utcTodayParts(d);
}

async function runFollowUpBatch(opts: {
  notificationType: "FOLLOW_UP_DUE" | "FOLLOW_UP_PREP";
  resolveKind: (followUpDate: string, todayStr: string) => FollowUpReminderKind;
  inAppMessage: (leadName: string, kind: FollowUpReminderKind) => string;
  leads: LeadWithClient[];
  todayStr: string;
  startOfTodayIso: string;
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
    .select("id, name, email, phone, notification_prefs")
    .in("id", assigneeIds);

  const userById = Object.fromEntries((users ?? []).map((u) => [u.id as string, u]));
  const leadIds = leads.map((l) => l.id as string);

  const { data: existingRows } = await supabase
    .from("notifications")
    .select("lead_id")
    .eq("type", opts.notificationType)
    .gte("created_at", opts.startOfTodayIso)
    .in("lead_id", leadIds);

  const alreadyNotifiedIds = new Set((existingRows ?? []).map((r) => r.lead_id as string));

  for (const lead of leads) {
    if (alreadyNotifiedIds.has(lead.id as string)) {
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
    const salesperson = {
      id: u.id as string,
      name: u.name as string,
      phone: (u.phone as string | null) ?? null,
      email: (u.email as string | null) ?? null,
    };
    const override = lead.clients?.twilio_whatsapp_override ?? null;
    const leadName = lead.name ?? "lead";

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
        continue;
      } else {
        results.whatsappFailed++;
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

/**
 * Sends WhatsApp follow-up reminders:
 * - **Due/overdue:** leads with follow_up_date on or before today (UTC), once per day each
 * - **Prep:** leads with follow_up_date tomorrow (UTC), once per day each
 */
export async function executeFollowUpReminders(): Promise<FollowUpReminderResult> {
  const supabase = createAdminClient();
  const { y, mo, day } = utcTodayParts();
  const todayStr = utcDateString(y, mo, day);
  const tomorrow = addUtcDays(y, mo, day, 1);
  const tomorrowStr = utcDateString(tomorrow.y, tomorrow.mo, tomorrow.day);
  const startOfTodayIso = new Date(Date.UTC(y, mo, day)).toISOString();

  const [{ data: dueRows, error: dueErr }, { data: prepRows, error: prepErr }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, clients ( twilio_whatsapp_override )")
      .lte("follow_up_date", todayStr)
      .in("status", [...ACTIVE_STATUSES])
      .not("assigned_to_id", "is", null)
      .not("follow_up_date", "is", null),
    supabase
      .from("leads")
      .select("*, clients ( twilio_whatsapp_override )")
      .eq("follow_up_date", tomorrowStr)
      .in("status", [...ACTIVE_STATUSES])
      .not("assigned_to_id", "is", null),
  ]);

  if (dueErr) throw new Error(`follow-up-reminders: ${dueErr.message}`);
  if (prepErr) throw new Error(`follow-up-reminders: ${prepErr.message}`);

  const due = await runFollowUpBatch({
    notificationType: "FOLLOW_UP_DUE",
    todayStr,
    startOfTodayIso,
    leads: (dueRows ?? []) as LeadWithClient[],
    resolveKind: (followUpDate, today) => (followUpDate < today ? "overdue" : "due"),
    inAppMessage: (leadName, kind) =>
      kind === "overdue" ? `Follow-up overdue: call ${leadName}` : `Follow-up due: call ${leadName}`,
  });

  const prep = await runFollowUpBatch({
    notificationType: "FOLLOW_UP_PREP",
    todayStr,
    startOfTodayIso,
    leads: (prepRows ?? []) as LeadWithClient[],
    resolveKind: () => "prep",
    inAppMessage: (leadName) => `Follow-up tomorrow: prepare for ${leadName}`,
  });

  return {
    ok: true,
    date: startOfTodayIso,
    due,
    prep,
    sent: due.whatsappSent + prep.whatsappSent,
    failed: due.whatsappFailed + prep.whatsappFailed,
    skipped: due.skipped + prep.skipped,
    totalLeads: due.totalLeads + prep.totalLeads,
  };
}
