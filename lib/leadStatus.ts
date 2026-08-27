import type { LeadRow } from "@/types";

/** Lead row with joined client SLA (e.g. Supabase `select('*, clients!leads_client_id_fkey ( response_time_limit_hours )')`). */
export type LeadWithClientResponseLimit = LeadRow & {
  clients: { response_time_limit_hours: number | null } | null;
};

const DEFAULT_RESPONSE_LIMIT_HOURS = 2;

export function isLeadSlow(
  status: string,
  createdAt: Date | string,
  responseTimeLimitHours: number | null | undefined
): boolean {
  if (status !== "NEW") return false;
  const hours = responseTimeLimitHours ?? DEFAULT_RESPONSE_LIMIT_HOURS;
  const created = new Date(createdAt).getTime();
  const limitMs = hours * 60 * 60 * 1000;
  return Date.now() - created > limitMs;
}

export function hoursSinceCreated(createdAt: Date | string): number {
  const created = new Date(createdAt).getTime();
  return (Date.now() - created) / (1000 * 60 * 60);
}
