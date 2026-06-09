import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadRow } from "@/types";

export type PickCallLogContext = {
  reason: string | null;
  callback_at: string | null;
  log_created_at: string;
};

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"]);

export function isActiveConvertLaterPick(lead: LeadRow): boolean {
  return (
    lead.is_convert_later_pick === true && ACTIVE_STATUSES.has(lead.status)
  );
}

/** Latest follow-up call log per lead (hold-up reason + callback time). */
export async function fetchLatestFollowUpLogsByLeadId(
  supabase: SupabaseClient,
  leadIds: string[]
): Promise<Record<string, PickCallLogContext>> {
  if (leadIds.length === 0) return {};

  const { data, error } = await supabase
    .from("call_logs")
    .select("lead_id, reason, callback_at, created_at, result")
    .in("lead_id", leadIds)
    .eq("result", "follow_up")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[convert-later-picks] call_logs fetch failed:", error);
    return {};
  }

  const map: Record<string, PickCallLogContext> = {};
  for (const row of data ?? []) {
    const leadId = row.lead_id as string;
    if (map[leadId]) continue;
    map[leadId] = {
      reason: (row.reason as string | null) ?? null,
      callback_at: (row.callback_at as string | null) ?? null,
      log_created_at: row.created_at as string,
    };
  }

  return map;
}

function callbackSortKey(
  lead: LeadRow,
  ctx: PickCallLogContext | undefined
): number | null {
  if (ctx?.callback_at) return new Date(ctx.callback_at).getTime();
  if (lead.follow_up_date) {
    return new Date(
      lead.follow_up_date.includes("T")
        ? lead.follow_up_date
        : `${lead.follow_up_date}T12:00:00`
    ).getTime();
  }
  return null;
}

/** Scheduled callbacks soonest-first; then by lead updated_at descending. */
export function sortConvertLaterPicks<T extends LeadRow>(
  leads: T[],
  logContext: Record<string, PickCallLogContext>
): T[] {
  return [...leads].sort((a, b) => {
    const cbA = callbackSortKey(a, logContext[a.id]);
    const cbB = callbackSortKey(b, logContext[b.id]);

    if (cbA != null && cbB != null) return cbA - cbB;
    if (cbA != null) return -1;
    if (cbB != null) return 1;

    return (
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  });
}

export function formatPickCallback(
  ctx: PickCallLogContext | undefined,
  followUpDate: string | null
): string | null {
  if (ctx?.callback_at) {
    const d = new Date(ctx.callback_at);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  if (followUpDate) {
    const d = new Date(
      followUpDate.includes("T") ? followUpDate : `${followUpDate}T12:00:00`
    );
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  }
  return null;
}
