import { createAdminClient } from "@/lib/supabase/admin";

export type VisitReminderResult = {
  scanned: number;
  sent: number;
  skipped: number;
};

async function claimOnce(claimKey: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("reminder_send_claims").insert({ claim_key: claimKey });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[work-project-reminders] claim failed", error);
  return false;
}

async function notifyAssignees(visitIds: string[], messageFor: (title: string, when: string) => string) {
  if (!visitIds.length) return 0;
  const supabase = createAdminClient();
  const { data: visits } = await supabase
    .from("work_project_visits")
    .select("id, title, scheduled_start_at, assigned_lead_id")
    .in("id", visitIds);
  const { data: assignees } = await supabase
    .from("work_project_visit_assignees")
    .select("visit_id, user_id")
    .in("visit_id", visitIds);
  const byVisit = new Map<string, string[]>();
  for (const row of (assignees ?? []) as Array<{ visit_id: string; user_id: string }>) {
    const list = byVisit.get(row.visit_id) ?? [];
    list.push(row.user_id);
    byVisit.set(row.visit_id, list);
  }
  const notes: Array<{ user_id: string; type: string; message: string; read: boolean }> = [];
  for (const visit of (visits ?? []) as Array<{ id: string; title: string; scheduled_start_at: string | null; assigned_lead_id: string | null }>) {
    const users = new Set(byVisit.get(visit.id) ?? []);
    if (visit.assigned_lead_id) users.add(visit.assigned_lead_id);
    const when = visit.scheduled_start_at ? new Date(visit.scheduled_start_at).toISOString() : "the scheduled time";
    for (const userId of users) {
      notes.push({
        user_id: userId,
        type: "WORK_PROJECT_ALERT",
        message: messageFor(visit.title, when),
        read: false,
      });
    }
  }
  if (!notes.length) return 0;
  const { error } = await supabase.from("notifications").insert(notes);
  if (error) {
    console.error("[work-project-reminders] notify failed", error);
    return 0;
  }
  return notes.length;
}

/** One in-app reminder about 24 hours before a scheduled visit. */
export async function executeVisitDayBeforeReminders(now = new Date()): Promise<VisitReminderResult> {
  const supabase = createAdminClient();
  const start = new Date(now.getTime() + 23.5 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 24.5 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("work_project_visits")
    .select("id, scheduled_start_at")
    .eq("status", "SCHEDULED")
    .gte("scheduled_start_at", start)
    .lt("scheduled_start_at", end);
  if (error) {
    console.error("[work-project-reminders] day-before query", error);
    return { scanned: 0, sent: 0, skipped: 0 };
  }
  const rows = (data ?? []) as Array<{ id: string; scheduled_start_at: string }>;
  const claimed: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const ok = await claimOnce(`visit24:${row.id}:${row.scheduled_start_at}`);
    if (ok) claimed.push(row.id);
    else skipped += 1;
  }
  const sent = await notifyAssignees(claimed, (title, when) => `${title} is scheduled for ${when}.`);
  return { scanned: rows.length, sent, skipped };
}

/** One in-app reminder on the morning of the visit. */
export async function executeVisitMorningReminders(now = new Date()): Promise<VisitReminderResult> {
  const supabase = createAdminClient();
  const day = now.toISOString().slice(0, 10);
  const start = `${day}T00:00:00.000Z`;
  const endDate = new Date(`${day}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const { data, error } = await supabase
    .from("work_project_visits")
    .select("id, scheduled_start_at")
    .eq("status", "SCHEDULED")
    .gte("scheduled_start_at", start)
    .lt("scheduled_start_at", endDate.toISOString());
  if (error) {
    console.error("[work-project-reminders] morning query", error);
    return { scanned: 0, sent: 0, skipped: 0 };
  }
  const rows = (data ?? []) as Array<{ id: string; scheduled_start_at: string }>;
  const claimed: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const ok = await claimOnce(`visitMorning:${row.id}:${day}`);
    if (ok) claimed.push(row.id);
    else skipped += 1;
  }
  const sent = await notifyAssignees(claimed, (title, when) => `${title} is today at ${when}.`);
  return { scanned: rows.length, sent, skipped };
}
