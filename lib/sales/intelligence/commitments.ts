import type { DailyCommitmentKind, DailyCommitmentProgress, SalesExecutionSettingsRow } from "./types";

export type CommitmentCounts = {
  prospects: number;
  calls: number;
  followUps: number;
  quotes: number;
  appointments: number;
  outreach: number;
};

const LABELS: Record<DailyCommitmentKind, string> = {
  NEW_PROSPECTS: "New prospects",
  OUTREACH_ATTEMPTS: "Outreach attempts",
  CALLS: "Calls",
  FOLLOW_UPS: "Follow-ups",
  QUOTES_CREATED: "Quotes created",
  APPOINTMENTS: "Appointments",
};

function statusFor(completed: number, target: number): DailyCommitmentProgress["status"] {
  if (completed <= 0) return "not_started";
  if (completed >= target) return "completed";
  return "in_progress";
}

/**
 * Build commitment progress rows ONLY for configured (non-null) targets.
 * Never emit 0/0.
 */
export function buildCommitmentProgress(
  settings: Pick<
    SalesExecutionSettingsRow,
    | "dailyProspectTarget"
    | "dailyCallTarget"
    | "dailyFollowupTarget"
    | "dailyQuoteTarget"
    | "dailyAppointmentTarget"
  > | null,
  counts: CommitmentCounts
): DailyCommitmentProgress[] {
  if (!settings) return [];

  const rows: DailyCommitmentProgress[] = [];

  const push = (kind: DailyCommitmentKind, target: number | null | undefined, completed: number) => {
    if (target == null || !Number.isFinite(target) || target <= 0) return;
    rows.push({
      kind,
      label: LABELS[kind],
      completed: Math.max(0, completed),
      target: Math.floor(target),
      status: statusFor(completed, target),
    });
  };

  push("NEW_PROSPECTS", settings.dailyProspectTarget, counts.prospects);
  push("CALLS", settings.dailyCallTarget, counts.calls);
  push("FOLLOW_UPS", settings.dailyFollowupTarget, counts.followUps);
  push("QUOTES_CREATED", settings.dailyQuoteTarget, counts.quotes);
  push("APPOINTMENTS", settings.dailyAppointmentTarget, counts.appointments);

  return rows;
}

export function hasAnyCommitmentConfigured(
  settings: Pick<
    SalesExecutionSettingsRow,
    | "dailyProspectTarget"
    | "dailyCallTarget"
    | "dailyFollowupTarget"
    | "dailyQuoteTarget"
    | "dailyAppointmentTarget"
  > | null
): boolean {
  if (!settings) return false;
  return [
    settings.dailyProspectTarget,
    settings.dailyCallTarget,
    settings.dailyFollowupTarget,
    settings.dailyQuoteTarget,
    settings.dailyAppointmentTarget,
  ].some((v) => v != null && Number.isFinite(v) && v > 0);
}

export function mergeExecutionSettings(
  clientBaseline: SalesExecutionSettingsRow | null,
  salespersonOverride: SalesExecutionSettingsRow | null
): SalesExecutionSettingsRow | null {
  if (!clientBaseline && !salespersonOverride) return null;
  if (!clientBaseline) return salespersonOverride;
  if (!salespersonOverride) return clientBaseline;

  return {
    id: salespersonOverride.id,
    clientId: salespersonOverride.clientId,
    salespersonId: salespersonOverride.salespersonId,
    dailyProspectTarget:
      salespersonOverride.dailyProspectTarget ?? clientBaseline.dailyProspectTarget,
    dailyCallTarget: salespersonOverride.dailyCallTarget ?? clientBaseline.dailyCallTarget,
    dailyFollowupTarget:
      salespersonOverride.dailyFollowupTarget ?? clientBaseline.dailyFollowupTarget,
    dailyQuoteTarget: salespersonOverride.dailyQuoteTarget ?? clientBaseline.dailyQuoteTarget,
    dailyAppointmentTarget:
      salespersonOverride.dailyAppointmentTarget ?? clientBaseline.dailyAppointmentTarget,
    stageInactivityHours:
      salespersonOverride.stageInactivityHours ?? clientBaseline.stageInactivityHours,
    quoteFollowupHours:
      salespersonOverride.quoteFollowupHours ?? clientBaseline.quoteFollowupHours,
    priorityWeights: {
      ...(clientBaseline.priorityWeights ?? {}),
      ...(salespersonOverride.priorityWeights ?? {}),
    },
    workingDays:
      salespersonOverride.workingDays && salespersonOverride.workingDays.length > 0
        ? salespersonOverride.workingDays
        : clientBaseline.workingDays,
    workStartTime: salespersonOverride.workStartTime ?? clientBaseline.workStartTime,
    workEndTime: salespersonOverride.workEndTime ?? clientBaseline.workEndTime,
  };
}
