import { resolveFollowUpDateTime } from "@/lib/call-log-constants";
import { format } from "date-fns";

export type FollowUpLead = {
  id: string;
  name: string | null;
  phone: string | null;
  follow_up_date: string | null;
  clientName: string;
};

export type FollowUpGroupKey = "OVERDUE" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "LATER";

export type FollowUpGroups = Record<FollowUpGroupKey, FollowUpLead[]>;

export function getFollowUpDateTime(
  lead: FollowUpLead,
  callbackAtByLeadId: Record<string, string>
): Date | null {
  return resolveFollowUpDateTime(lead.follow_up_date, callbackAtByLeadId[lead.id]);
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function groupFollowUps(
  leads: FollowUpLead[],
  callbackAtByLeadId: Record<string, string>
): FollowUpGroups {
  const groups: FollowUpGroups = {
    OVERDUE: [],
    TODAY: [],
    TOMORROW: [],
    THIS_WEEK: [],
    LATER: [],
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow.getTime() + 86400000);
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  for (const lead of leads) {
    const d = getFollowUpDateTime(lead, callbackAtByLeadId);
    if (!d) continue;
    if (d < startOfToday) groups.OVERDUE.push(lead);
    else if (d < startOfTomorrow) groups.TODAY.push(lead);
    else if (d < startOfDayAfterTomorrow) groups.TOMORROW.push(lead);
    else if (d < startOfNextWeek) groups.THIS_WEEK.push(lead);
    else groups.LATER.push(lead);
  }

  const sortByCallback = (items: FollowUpLead[]) =>
    [...items].sort((a, b) => {
      const aAt = getFollowUpDateTime(a, callbackAtByLeadId)?.getTime() ?? 0;
      const bAt = getFollowUpDateTime(b, callbackAtByLeadId)?.getTime() ?? 0;
      return aAt - bAt;
    });

  for (const key of Object.keys(groups) as FollowUpGroupKey[]) {
    groups[key] = sortByCallback(groups[key]);
  }

  return groups;
}

export function buildFollowUpCountByDateKey(
  leads: FollowUpLead[],
  callbackAtByLeadId: Record<string, string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    const at = getFollowUpDateTime(lead, callbackAtByLeadId);
    if (!at) continue;
    const key = toDateKey(at);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function filterLeadsByDateKey(
  leads: FollowUpLead[],
  callbackAtByLeadId: Record<string, string>,
  dateKey: string
): FollowUpLead[] {
  return leads
    .filter((lead) => {
      const at = getFollowUpDateTime(lead, callbackAtByLeadId);
      return at ? toDateKey(at) === dateKey : false;
    })
    .sort((a, b) => {
      const aAt = getFollowUpDateTime(a, callbackAtByLeadId)?.getTime() ?? 0;
      const bAt = getFollowUpDateTime(b, callbackAtByLeadId)?.getTime() ?? 0;
      return aAt - bAt;
    });
}
