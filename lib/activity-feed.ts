import { createAdminClient } from "@/lib/supabase/admin";
import { format } from "date-fns";
import type { ActivityEventDTO } from "@/lib/activity-feed-types";

export type { ActivityEventDTO, ActivityEventKind } from "@/lib/activity-feed-types";

async function leadClientMap(
  supabase: ReturnType<typeof createAdminClient>,
  leadIds: string[]
): Promise<Record<string, { name: string; clientName: string; createdAt: string }>> {
  if (leadIds.length === 0) return {};
  const { data } = await supabase
    .from("leads")
    .select("id, name, created_at, clients!leads_client_id_fkey ( name )")
    .in("id", leadIds);
  const out: Record<string, { name: string; clientName: string; createdAt: string }> = {};
  for (const row of data ?? []) {
    out[row.id as string] = {
      name: (row.name as string) ?? "—",
      clientName: (row as { clients?: { name?: string } | null }).clients?.name ?? "",
      createdAt: row.created_at as string,
    };
  }
  return out;
}

export async function fetchActivityEvents(limit = 15): Promise<ActivityEventDTO[]> {
  const supabase = createAdminClient();

  const [
    newLeadsRes,
    wonLogsRes,
    followLogsRes,
    nqLogsRes,
    answeredLogsRes,
    flagNotifsRes,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, created_at, clients!leads_client_id_fkey ( name )")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("call_logs")
      .select("id, created_at, user_id, lead_id")
      .eq("outcome", "WON")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("call_logs")
      .select("id, created_at, user_id, lead_id, follow_up_date")
      .eq("outcome", "FOLLOW_UP")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("call_logs")
      .select("id, created_at, user_id, lead_id")
      .eq("outcome", "NOT_QUALIFIED")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("call_logs")
      .select("id, created_at, user_id, lead_id")
      .eq("outcome", "ANSWERED")
      .order("created_at", { ascending: true }),
    supabase
      .from("notifications")
      .select("id, created_at, lead_id, message")
      .eq("type", "LEAD_FLAG")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const allLeadIds = new Set<string>();
  for (const l of [...(wonLogsRes.data ?? []), ...(followLogsRes.data ?? []), ...(nqLogsRes.data ?? [])]) {
    allLeadIds.add(l.lead_id as string);
  }
  for (const l of answeredLogsRes.data ?? []) allLeadIds.add(l.lead_id as string);

  const leadInfo = await leadClientMap(supabase, Array.from(allLeadIds));

  const userIds = new Set<string>();
  for (const l of [...(wonLogsRes.data ?? []), ...(followLogsRes.data ?? []), ...(nqLogsRes.data ?? [])]) {
    userIds.add(l.user_id as string);
  }
  for (const l of answeredLogsRes.data ?? []) userIds.add(l.user_id as string);
  const { data: users } =
    userIds.size > 0 ? await supabase.from("users").select("id, name").in("id", Array.from(userIds)) : { data: [] };
  const userName = Object.fromEntries((users ?? []).map((u) => [u.id as string, u.name as string]));

  const events: ActivityEventDTO[] = [];

  for (const l of newLeadsRes.data ?? []) {
    const clientName = (l as { clients?: { name?: string } | null }).clients?.name ?? "";
    const target = (l.name as string) ?? "—";
    events.push({
      id: `nl-${l.id}`,
      type: "NEW_LEAD",
      timestamp: l.created_at as string,
      actorName: null,
      targetLeadName: target,
      clientName,
      message: `${target} → ${clientName || "Client"}`,
    });
  }

  for (const l of wonLogsRes.data ?? []) {
    const info = leadInfo[l.lead_id as string];
    const target = info?.name ?? "—";
    const clientName = info?.clientName ?? "";
    const uid = l.user_id as string;
    const actor = userName[uid] ?? null;
    events.push({
      id: `won-${l.id}`,
      type: "DEAL_WON",
      timestamp: l.created_at as string,
      actorName: actor,
      targetLeadName: target,
      clientName,
      message: actor
        ? `${actor.split(/\s+/)[0] ?? actor} closed with ${target}${clientName ? ` · ${clientName}` : ""}`
        : `Deal won · ${target}`,
    });
  }

  for (const l of followLogsRes.data ?? []) {
    const uid = l.user_id as string;
    const actor = userName[uid] ?? null;
    const info = leadInfo[l.lead_id as string];
    const target = info?.name ?? "—";
    const clientName = info?.clientName ?? "";
    const when = l.follow_up_date
      ? format(new Date(l.follow_up_date as string), "EEE")
      : "soon";
    events.push({
      id: `fu-${l.id}`,
      type: "FOLLOW_UP_SET",
      timestamp: l.created_at as string,
      actorName: actor,
      targetLeadName: target,
      clientName,
      message: actor
        ? `${actor.split(/\s+/)[0] ?? actor} scheduled ${target} for ${when}`
        : `Follow-up set for ${target}`,
    });
  }

  for (const l of nqLogsRes.data ?? []) {
    const uid = l.user_id as string;
    const actor = userName[uid] ?? null;
    const info = leadInfo[l.lead_id as string];
    const target = info?.name ?? "—";
    const clientName = info?.clientName ?? "";
    events.push({
      id: `nq-${l.id}`,
      type: "NOT_QUALIFIED",
      timestamp: l.created_at as string,
      actorName: actor,
      targetLeadName: target,
      clientName,
      message: `${target}${clientName ? ` · ${clientName}` : ""}`,
    });
  }

  const answeredRows = answeredLogsRes.data ?? [];
  const firstAnsweredByLead = new Map<string, (typeof answeredRows)[number]>();
  for (const log of answeredRows) {
    const lid = log.lead_id as string;
    if (!firstAnsweredByLead.has(lid)) firstAnsweredByLead.set(lid, log);
  }
  for (const l of Array.from(firstAnsweredByLead.values())) {
    const uid = l.user_id as string;
    const actor = userName[uid] ?? null;
    const info = leadInfo[l.lead_id as string];
    const target = info?.name ?? "—";
    const clientName = info?.clientName ?? "";
    events.push({
      id: `ct-${l.id}`,
      type: "CONTACTED",
      timestamp: l.created_at as string,
      actorName: actor,
      targetLeadName: target,
      clientName,
      message: actor ? `First contact · ${target}${clientName ? ` (${clientName})` : ""}` : `Contacted ${target}`,
    });
  }

  const flagRows = flagNotifsRes.data ?? [];
  const dedupedFlags: typeof flagRows = [];
  const seenFlagLead = new Set<string>();
  for (const n of flagRows) {
    const lid = n.lead_id as string | null;
    if (!lid || seenFlagLead.has(lid)) continue;
    seenFlagLead.add(lid);
    dedupedFlags.push(n);
  }
  const flagLeadIds = dedupedFlags.map((n) => n.lead_id as string).filter(Boolean);
  const flagLeadInfo = await leadClientMap(supabase, flagLeadIds);

  for (const n of dedupedFlags) {
    const lid = n.lead_id as string | null;
    if (!lid) continue;
    const info = flagLeadInfo[lid];
    if (!info) continue;
    const hours = Math.max(1, Math.round((Date.now() - new Date(info.createdAt).getTime()) / 3_600_000));
    events.push({
      id: `fl-${n.id}`,
      type: "FLAGGED",
      timestamp: n.created_at as string,
      actorName: null,
      targetLeadName: info.name,
      clientName: info.clientName,
      message: `Lead ${info.name} uncontacted for ${hours}h${info.clientName ? ` · ${info.clientName}` : ""}`,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, limit);
}
