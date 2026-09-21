import { STALE_GENERATION_MS } from "./config";
import type { WeeklyReportStatus } from "./types";

export function isInFlight(status: WeeklyReportStatus): boolean {
  return status === "collecting_data" || status === "analysing" || status === "generating";
}

export function isStaleInFlight(
  row: { generation_status: WeeklyReportStatus; updated_at: string; started_at: string | null },
  now = new Date()
): boolean {
  if (!isInFlight(row.generation_status)) return false;
  const started = Date.parse(row.started_at || row.updated_at);
  if (!Number.isFinite(started)) return true;
  return now.getTime() - started > STALE_GENERATION_MS;
}
