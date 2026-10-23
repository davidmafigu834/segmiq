import { isBillableInternalAction } from "./quota";

export type SyntheticBillingPeriod = {
  id: string;
  start: string;
  end: string;
};

export type SyntheticUsageEvent = {
  eventKey: string;
  type: "customer_conversation" | "internal_ai_action";
  occurredAt: string;
  subjectKey?: string;
  channel?: string;
  successful?: boolean;
  testMode?: boolean;
  toolName?: string;
  status?: string;
  humanApproved?: boolean;
};

export type ShadowUsageRow = {
  eventKey: string;
  outcome:
    | "duplicate"
    | "excluded_failed"
    | "excluded_test"
    | "excluded_unsupported"
    | "window_reused"
    | "shadow_recorded";
  periodId: string | null;
  units: number;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

function periodAt(
  periods: readonly SyntheticBillingPeriod[],
  occurredAt: number,
): string | null {
  return (
    periods.find(
      (period) =>
        Date.parse(period.start) <= occurredAt &&
        occurredAt < Date.parse(period.end),
    )?.id ?? null
  );
}

export function reconcileSyntheticShadowUsage(input: {
  periods: readonly SyntheticBillingPeriod[];
  events: readonly SyntheticUsageEvent[];
}): { rows: ShadowUsageRow[]; unitsByPeriod: Record<string, number> } {
  const seen = new Set<string>();
  const windows = new Map<
    string,
    { openedAt: number; periodId: string | null }
  >();
  const rows: ShadowUsageRow[] = [];
  const unitsByPeriod: Record<string, number> = {};

  for (const event of input.events) {
    if (seen.has(`${event.type}:${event.eventKey}`)) {
      rows.push({
        eventKey: event.eventKey,
        outcome: "duplicate",
        periodId: null,
        units: 0,
      });
      continue;
    }
    seen.add(`${event.type}:${event.eventKey}`);
    const occurredAt = Date.parse(event.occurredAt);
    if (!Number.isFinite(occurredAt)) {
      throw new Error(`Invalid event time: ${event.eventKey}`);
    }

    if (event.type === "internal_ai_action") {
      const billable = isBillableInternalAction({
        toolName: event.toolName ?? "",
        status: event.status ?? "",
        testMode: event.testMode ?? false,
        humanApproved: event.humanApproved,
      });
      const periodId = periodAt(input.periods, occurredAt);
      const outcome = billable ? "shadow_recorded" : "excluded_unsupported";
      rows.push({
        eventKey: event.eventKey,
        outcome,
        periodId,
        units: billable ? 1 : 0,
      });
      if (billable && periodId)
        unitsByPeriod[periodId] = (unitsByPeriod[periodId] ?? 0) + 1;
      continue;
    }

    if (event.testMode) {
      rows.push({
        eventKey: event.eventKey,
        outcome: "excluded_test",
        periodId: null,
        units: 0,
      });
      continue;
    }
    if (!event.successful) {
      rows.push({
        eventKey: event.eventKey,
        outcome: "excluded_failed",
        periodId: null,
        units: 0,
      });
      continue;
    }
    if (event.channel !== "whatsapp" || !event.subjectKey) {
      rows.push({
        eventKey: event.eventKey,
        outcome: "excluded_unsupported",
        periodId: null,
        units: 0,
      });
      continue;
    }

    const key = `${event.channel}:${event.subjectKey}`;
    const existing = windows.get(key);
    if (
      existing &&
      existing.openedAt <= occurredAt &&
      occurredAt < existing.openedAt + WINDOW_MS
    ) {
      rows.push({
        eventKey: event.eventKey,
        outcome: "window_reused",
        periodId: existing.periodId,
        units: 0,
      });
      continue;
    }

    const periodId = periodAt(input.periods, occurredAt);
    windows.set(key, { openedAt: occurredAt, periodId });
    rows.push({
      eventKey: event.eventKey,
      outcome: "shadow_recorded",
      periodId,
      units: 1,
    });
    if (periodId) unitsByPeriod[periodId] = (unitsByPeriod[periodId] ?? 0) + 1;
  }

  return { rows, unitsByPeriod };
}
