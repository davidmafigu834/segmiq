import type { LeadRow } from "./types";
import { parseDateKey, startOfDay, toDateKey } from "./calendar-utils";

export type FollowUpGroupKey = "OVERDUE" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "LATER";

export type FollowUpGroups = Record<FollowUpGroupKey, LeadRow[]>;

export function getFollowUpDate(lead: LeadRow): Date | null {
  if (!lead.follow_up_date) return null;
  const raw = lead.follow_up_date;
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function groupFollowUps(leads: LeadRow[]): FollowUpGroups {
  const groups: FollowUpGroups = {
    OVERDUE: [],
    TODAY: [],
    TOMORROW: [],
    THIS_WEEK: [],
    LATER: [],
  };

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow.getTime() + 86400000);
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  for (const lead of leads) {
    const d = getFollowUpDate(lead);
    if (!d) continue;
    const day = startOfDay(d);
    if (day < startOfToday) groups.OVERDUE.push(lead);
    else if (day < startOfTomorrow) groups.TODAY.push(lead);
    else if (day < startOfDayAfterTomorrow) groups.TOMORROW.push(lead);
    else if (day < startOfNextWeek) groups.THIS_WEEK.push(lead);
    else groups.LATER.push(lead);
  }

  const sortByDate = (items: LeadRow[]) =>
    [...items].sort(
      (a, b) => (getFollowUpDate(a)?.getTime() ?? 0) - (getFollowUpDate(b)?.getTime() ?? 0)
    );

  for (const key of Object.keys(groups) as FollowUpGroupKey[]) {
    groups[key] = sortByDate(groups[key]);
  }

  return groups;
}

export function buildFollowUpCountByDateKey(leads: LeadRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    const at = getFollowUpDate(lead);
    if (!at) continue;
    const key = toDateKey(at);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function filterLeadsByDateKey(leads: LeadRow[], dateKey: string): LeadRow[] {
  return leads
    .filter((lead) => {
      const at = getFollowUpDate(lead);
      return at ? toDateKey(at) === dateKey : false;
    })
    .sort(
      (a, b) => (getFollowUpDate(a)?.getTime() ?? 0) - (getFollowUpDate(b)?.getTime() ?? 0)
    );
}

export function isDateKeyToday(dateKey: string): boolean {
  return toDateKey(new Date()) === dateKey;
}

export function isDateKeyOverdue(dateKey: string): boolean {
  return parseDateKey(dateKey) < startOfDay(new Date());
}
