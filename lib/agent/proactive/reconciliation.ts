import { createAdminClient } from "@/lib/supabase/admin";
import { now } from "@/lib/clock";
import { addBusinessDays } from "./business-days";
import { scheduleEvaluation } from "./jobs";
import { TEMPORAL_TRIGGER_TYPES } from "./registry";
import { getProactiveSettings } from "./settings";
import { drainUnprocessedEvents } from "./events";
import { recoverStuckEvaluations, runDueProactiveJobs } from "./evaluate";
import { loadCachedCompanyBrainSnapshot } from "@/lib/company-brain";

/**
 * Low-frequency safety net — not the primary scheduler.
 * Recovers stuck jobs and schedules missed deal-inactivity evaluations.
 */
export async function reconcileProactiveJobs(): Promise<{
  recovered: number;
  drained: number;
  inactivityBackfill: number;
}> {
  const recovered = await recoverStuckEvaluations();
  const drained = await drainUnprocessedEvents(100);
  const inactivityBackfill = await backfillInactiveDeals();
  return { recovered, drained, inactivityBackfill };
}

export async function runProactiveWorker(): Promise<{
  drained: number;
  claimed: number;
  evaluated: number;
  recovered: number;
}> {
  const recovered = await recoverStuckEvaluations();
  const drained = await drainUnprocessedEvents(40);
  const due = await runDueProactiveJobs(20);
  return { drained, claimed: due.claimed, evaluated: due.evaluated, recovered };
}

async function backfillInactiveDeals(): Promise<number> {
  const supabase = createAdminClient();
  const { data: settingsRows } = await supabase
    .from("agent_company_settings")
    .select("client_id, proactive_enabled, proactive_config")
    .eq("proactive_enabled", true)
    .limit(200);
  let created = 0;
  for (const row of settingsRows ?? []) {
    const clientId = row.client_id as string;
    const settings = await getProactiveSettings(clientId);
    if (!settings.config.dealInactivityEnabled) continue;
    const brain = await loadCachedCompanyBrainSnapshot(clientId).catch(() => null);
    const timezone = brain?.canonical.timezone ?? "Africa/Harare";
    const workingDays = brain?.canonical.workingDays ?? [1, 2, 3, 4, 5];
    const threshold = addBusinessDays({
      from: now(),
      days: -settings.config.dealInactivityBusinessDays,
      timezone,
      workingDays,
    });
    const { data: deals } = await supabase
      .from("deals")
      .select("id, originating_lead_id, stage, last_meaningful_activity_at")
      .eq("client_id", clientId)
      .in("stage", settings.config.dealInactivityStages)
      .or(
        `last_meaningful_activity_at.lt.${threshold.toISOString()},last_meaningful_activity_at.is.null`
      )
      .limit(40);
    for (const deal of deals ?? []) {
      const job = await scheduleEvaluation({
        clientId,
        leadId: deal.originating_lead_id as string,
        dealId: deal.id as string,
        conversationId: deal.originating_lead_id as string,
        triggerType: TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE,
        scheduledAt: now(),
        payload: { source: "reconciliation", stage: deal.stage },
        actorOrigin: "SYSTEM",
      });
      if (job) created += 1;
    }
  }
  return created;
}
