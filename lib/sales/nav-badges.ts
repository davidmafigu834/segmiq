import { isToday } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchInboxConversations } from "@/lib/inbox/fetch-conversations";
import { countInboxFilters } from "@/lib/inbox/queue-filters";
import type { ClassifiableLead } from "@/lib/lead-lanes";
import { countLaneMetrics } from "@/lib/sales-mirror";

export type SalesNavBadges = {
  callNow: number;
  followUpsToday: number;
  hotLeads: number;
  needsReply: number;
  followUpDue: number;
};

const EMPTY_BADGES: SalesNavBadges = {
  callNow: 0,
  followUpsToday: 0,
  hotLeads: 0,
  needsReply: 0,
  followUpDue: 0,
};

export async function fetchSalesNavBadges(
  userId: string,
  clientId: string | null
): Promise<SalesNavBadges> {
  if (!userId) return EMPTY_BADGES;

  const supabase = createAdminClient();

  const [inboxConversations, leadsResult] = await Promise.all([
    clientId
      ? fetchInboxConversations({ role: "SALESPERSON", userId, clientId })
      : Promise.resolve([]),
    supabase
      .from("leads")
      .select("status, created_at, follow_up_date, score, is_stale")
      .eq("assigned_to_id", userId)
      .or("is_archived.is.null,is_archived.eq.false"),
  ]);

  let leads = leadsResult.data ?? [];
  if (leadsResult.error && String(leadsResult.error.message).includes("is_archived")) {
    const retry = await supabase
      .from("leads")
      .select("status, created_at, follow_up_date, score, is_stale")
      .eq("assigned_to_id", userId);
    leads = retry.data ?? [];
  }

  const inboxCounts = countInboxFilters(inboxConversations, userId);
  const activeLeads = leads.filter(
    (l) => !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status as string)
  ) as ClassifiableLead[];

  const { callNow } = countLaneMetrics(activeLeads);
  const followUpsToday = activeLeads.filter(
    (l) => l.follow_up_date && isToday(new Date(l.follow_up_date as string))
  ).length;

  return {
    callNow,
    followUpsToday,
    hotLeads: inboxCounts.hot,
    needsReply: inboxCounts.awaiting_reply,
    followUpDue: inboxCounts.follow_up_due,
  };
}
