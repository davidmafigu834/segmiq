import { createAdminClient } from "@/lib/supabase/admin";
import { formatPeriodLabel } from "./period";
import type { WeekPeriod } from "./types";

export async function notifyWeeklyReportReady(opts: {
  clientId: string;
  reportId: string;
  period: WeekPeriod;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("weekly_report_id", opts.reportId)
    .eq("type", "WEEKLY_TEAM_REPORT")
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: managers, error } = await supabase
    .from("users")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);
  if (error) {
    console.error("[weekly-report] manager lookup failed", error.message);
    return;
  }
  const label = formatPeriodLabel(opts.period);
  const message = `Your Weekly Sales Performance Report for ${label} is ready.`;
  const rows = (managers ?? []).map((m) => ({
    user_id: m.id as string,
    type: "WEEKLY_TEAM_REPORT",
    message,
    read: false,
    client_id: opts.clientId,
    weekly_report_id: opts.reportId,
  }));
  if (rows.length === 0) return;
  const { error: insertError } = await supabase.from("notifications").insert(rows);
  if (insertError) {
    console.error("[weekly-report] notification insert failed", insertError.message);
  }
}
