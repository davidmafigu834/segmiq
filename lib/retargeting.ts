// Retargeting graduation + audience lifecycle — pure helpers and server sync.
// No Meta Ads API; ad_live is set manually by the agency.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  RECOVER_TIER_MONTH_MS,
  type ClassifiableLead,
} from "@/lib/lead-lanes";
import {
  RETARGETING_GRADUATED_KEY,
  resolveSegmentLeads,
  type SegmentFilter,
} from "@/lib/audience-segments";

/** Graduation cutoff — aligned with recoverAgeTier month_plus boundary. */
export const RETARGETING_GRADUATION_AGE_MS = RECOVER_TIER_MONTH_MS;

/**
 * Meta custom audiences need ~100 matched users to deliver; 1000+ is recommended
 * for reliable performance. Default targets the technical minimum.
 */
export const RETARGETING_AUDIENCE_THRESHOLD = 100;

/** Show building progress on the salesperson banner from this fraction of threshold. */
export const RETARGETING_PROGRESS_SHOW_RATIO = 0.5;

export type RetargetingLifecycleStatus =
  | "building"
  | "ready"
  | "ad_pending"
  | "ad_live";

export type RetargetingStatusView = {
  clientId: string;
  clientName: string;
  segmentId: string | null;
  status: RetargetingLifecycleStatus;
  leadCount: number;
  threshold: number;
  hasExport: boolean;
  adLiveAt: string | null;
  lastNudgeAt: string | null;
  bannerDismissedUntil: string | null;
  openTaskId: string | null;
};

/** Pure: uncontacted leads aged past the graduation cutoff. */
export function isRetargetingGraduated(
  lead: ClassifiableLead,
  now: Date = new Date()
): boolean {
  if (lead.status !== "NEW") return false;
  const age = now.getTime() - new Date(lead.created_at).getTime();
  return age >= RETARGETING_GRADUATION_AGE_MS;
}

/** Remove graduated leads from manual call queues without changing lane classification. */
export function excludeGraduatedLeads<T extends ClassifiableLead>(
  leads: T[],
  now: Date = new Date()
): T[] {
  return leads.filter((l) => !isRetargetingGraduated(l, now));
}

/** Pure status derivation from counts and persisted signals. */
export function deriveRetargetingStatus(input: {
  leadCount: number;
  threshold: number;
  hasExport: boolean;
  adLiveAt: string | null;
}): RetargetingLifecycleStatus {
  if (input.adLiveAt) return "ad_live";
  if (input.hasExport) return "ad_pending";
  if (input.leadCount >= input.threshold) return "ready";
  return "building";
}

export function retargetingStatusLabel(status: RetargetingLifecycleStatus): string {
  switch (status) {
    case "building":
      return "Building audience";
    case "ready":
      return "Ready to export";
    case "ad_pending":
      return "Ad pending";
    case "ad_live":
      return "Ad live";
  }
}

const GRADUATED_FILTERS: SegmentFilter[] = [
  { field: "status", operator: "eq", value: "NEW" },
];

export async function countGraduatedLeads(clientId: string): Promise<number> {
  const minAgeDays = Math.floor(RETARGETING_GRADUATION_AGE_MS / 86_400_000);
  const leads = await resolveSegmentLeads(clientId, GRADUATED_FILTERS, "and", {
    minAgeDays,
  });
  return leads.length;
}

export async function getRetargetingSegmentId(
  clientId: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("audience_segments")
    .select("id")
    .eq("client_id", clientId)
    .eq("predefined_key", RETARGETING_GRADUATED_KEY)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

async function segmentHasExport(segmentId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("audience_export_history")
    .select("id", { count: "exact", head: true })
    .eq("segment_id", segmentId);
  return (count ?? 0) > 0;
}

export async function syncRetargetingForClient(
  clientId: string,
  clientName: string
): Promise<RetargetingStatusView> {
  const supabase = createAdminClient();
  const segmentId = await getRetargetingSegmentId(clientId);
  const leadCount = await countGraduatedLeads(clientId);
  const hasExport = segmentId ? await segmentHasExport(segmentId) : false;

  const { data: stateRow } = await supabase
    .from("retargeting_audience_state")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  const adLiveAt = (stateRow?.ad_live_at as string) ?? null;
  const status = deriveRetargetingStatus({
    leadCount,
    threshold: RETARGETING_AUDIENCE_THRESHOLD,
    hasExport,
    adLiveAt,
  });

  await supabase.from("retargeting_audience_state").upsert(
    {
      client_id: clientId,
      segment_id: segmentId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );

  // Auto-task when crossing into ready (or still ready without open task)
  let openTaskId: string | null = null;
  if (status === "ready" || status === "ad_pending") {
    const { data: existingTask } = await supabase
      .from("agency_tasks")
      .select("id")
      .eq("client_id", clientId)
      .eq("task_type", "retargeting_ad")
      .eq("status", "open")
      .maybeSingle();

    if (existingTask?.id) {
      openTaskId = existingTask.id as string;
      await supabase
        .from("agency_tasks")
        .update({
          lead_count: leadCount,
          body: `${leadCount} graduated leads are ready for Meta retargeting export.`,
        })
        .eq("id", openTaskId);
    } else if (status === "ready" || status === "ad_pending") {
      const { data: created } = await supabase
        .from("agency_tasks")
        .insert({
          client_id: clientId,
          task_type: "retargeting_ad",
          title: `Build retargeting ad for ${clientName} — ${leadCount} leads`,
          body: `${leadCount} graduated leads are ready for Meta retargeting export.`,
          status: "open",
          lead_count: leadCount,
        })
        .select("id")
        .single();
      openTaskId = (created?.id as string) ?? null;
    }
  }

  if (status === "ad_live") {
    await supabase
      .from("agency_tasks")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("client_id", clientId)
      .eq("task_type", "retargeting_ad")
      .eq("status", "open");
  }

  const { data: openTask } = await supabase
    .from("agency_tasks")
    .select("id")
    .eq("client_id", clientId)
    .eq("task_type", "retargeting_ad")
    .eq("status", "open")
    .maybeSingle();
  openTaskId = (openTask?.id as string) ?? openTaskId;

  return {
    clientId,
    clientName,
    segmentId,
    status,
    leadCount,
    threshold: RETARGETING_AUDIENCE_THRESHOLD,
    hasExport,
    adLiveAt,
    lastNudgeAt: (stateRow?.last_nudge_at as string) ?? null,
    bannerDismissedUntil: (stateRow?.banner_dismissed_until as string) ?? null,
    openTaskId,
  };
}

export function canNudgeRetargeting(lastNudgeAt: string | null, now = new Date()): boolean {
  if (!lastNudgeAt) return true;
  const last = new Date(lastNudgeAt);
  const dayMs = 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() >= dayMs;
}

export async function recordRetargetingNudge(
  clientId: string,
  actor: { id: string; name: string; role: string },
  source: "salesperson" | "client_manager"
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const now = new Date();

  const { data: state } = await supabase
    .from("retargeting_audience_state")
    .select("last_nudge_at")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!canNudgeRetargeting((state?.last_nudge_at as string) ?? null, now)) {
    return { ok: false, error: "Nudge already sent today for this client" };
  }

  await supabase.from("retargeting_audience_state").upsert(
    {
      client_id: clientId,
      last_nudge_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "client_id" }
  );

  const { data: task } = await supabase
    .from("agency_tasks")
    .select("id, nudge_count, supporting_data")
    .eq("client_id", clientId)
    .eq("task_type", "retargeting_ad")
    .eq("status", "open")
    .maybeSingle();

  if (task?.id) {
    const prev = (task.supporting_data as Record<string, unknown>) ?? {};
    const nudges = Array.isArray(prev.nudges) ? [...prev.nudges] : [];
    nudges.push({
      at: now.toISOString(),
      by: actor.name,
      role: actor.role,
      source,
    });
    await supabase
      .from("agency_tasks")
      .update({
        last_nudged_at: now.toISOString(),
        nudge_count: ((task.nudge_count as number) ?? 0) + 1,
        supporting_data: { ...prev, nudges },
      })
      .eq("id", task.id as string);
  }

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "AGENCY_ADMIN")
    .eq("is_active", true);

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  const clientName = (client?.name as string) ?? "Client";
  const msg = `${actor.name} (${source.replace("_", " ")}) nudged: retargeting ad needed for ${clientName}.`;

  for (const admin of admins ?? []) {
    await supabase.from("notifications").insert({
      user_id: admin.id as string,
      type: "LEAD_FLAG",
      message: msg,
      read: false,
      client_id: clientId,
    });
  }

  // Log to lead_events on a representative graduated lead for audit trail
  const leads = await resolveSegmentLeads(clientId, GRADUATED_FILTERS, "and", {
    minAgeDays: Math.floor(RETARGETING_GRADUATION_AGE_MS / 86_400_000),
  });
  const sampleLead = leads[0];
  if (sampleLead) {
    const { logLeadEvent } = await import("@/lib/lead-events");
    await logLeadEvent({
      leadId: sampleLead.id,
      clientId,
      actor: { id: actor.id, name: actor.name, role: actor.role },
      eventType: "NOTE_ADDED",
      eventData: {
        kind: "RETARGETING_NUDGE",
        source,
        message: msg,
      },
    });
  }

  return { ok: true };
}
