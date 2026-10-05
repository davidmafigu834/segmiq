import { createAdminClient } from "@/lib/supabase/admin";

export async function withinAiBudget(clientId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("agent_company_settings")
    .select("daily_ai_request_limit, monthly_ai_budget")
    .eq("client_id", clientId)
    .maybeSingle();
  const dailyLimit = Number(settings?.daily_ai_request_limit ?? 400);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", start.toISOString());
  if ((count ?? 0) >= dailyLimit) {
    return { ok: false, reason: "This company has reached today's AI request limit. SegmiQ still works without the assistant." };
  }
  const budget = settings?.monthly_ai_budget == null ? null : Number(settings.monthly_ai_budget);
  if (budget != null && budget >= 0) {
    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("ai_usage_events")
      .select("estimated_cost")
      .eq("client_id", clientId)
      .gte("created_at", month.toISOString())
      .limit(5000);
    const spent = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);
    if (spent >= budget) {
      return { ok: false, reason: "This company has reached its monthly AI budget. Records are unchanged." };
    }
  }
  return { ok: true };
}
