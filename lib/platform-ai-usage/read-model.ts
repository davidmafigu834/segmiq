import { createAdminClient } from "@/lib/supabase/admin";
import { platformAiUsageFlags } from "./flags";
import { calculateQuota } from "./quota";
import type { AiUsageOverview } from "./types";

type Row = Record<string, unknown>;

export async function loadAiUsageOverviews(
  clientId?: string,
): Promise<AiUsageOverview[]> {
  if (!platformAiUsageFlags.reporting) return [];
  const db = createAdminClient();
  let clientsQuery = db.from("clients").select("id,name").order("name");
  if (clientId) clientsQuery = clientsQuery.eq("id", clientId);
  const now = new Date().toISOString();
  const [
    clientsRes,
    accountsRes,
    periodsRes,
    windowsRes,
    eventsRes,
    topupsRes,
  ] = await Promise.all([
    clientsQuery,
    db
      .from("platform_commercial_accounts")
      .select("client_id,ai_sku,status,agreement_ref"),
    db
      .from("platform_ai_billing_periods")
      .select(
        "id,client_id,period_start,period_end,included_conversations,included_ai_actions",
      )
      .eq("state", "open")
      .lte("period_start", now)
      .gt("period_end", now),
    db
      .from("platform_ai_conversation_windows")
      .select("client_id,billing_period_id,metering_mode,opened_at")
      .order("opened_at", { ascending: false })
      .limit(10000),
    db
      .from("platform_ai_usage_source_events")
      .select(
        "client_id,billing_period_id,usage_type,outcome,metering_mode,occurred_at",
      )
      .in("outcome", ["shadow_recorded", "financial_recorded"])
      .order("occurred_at", { ascending: false })
      .limit(10000),
    db
      .from("platform_ai_topup_requests")
      .select("client_id,billing_period_id,pack_quantity,units_per_pack,status")
      .eq("status", "active"),
  ]);

  if (clientsRes.error) throw clientsRes.error;
  // During staged rollout the new tables may not exist yet. Returning an empty
  // read model is safer than presenting operational logs as contracted usage.
  if (
    accountsRes.error ||
    periodsRes.error ||
    windowsRes.error ||
    eventsRes.error ||
    topupsRes.error
  ) {
    return [];
  }

  const accounts = new Map(
    ((accountsRes.data ?? []) as Row[]).map((row) => [
      row.client_id as string,
      row,
    ]),
  );
  const periods = new Map(
    ((periodsRes.data ?? []) as Row[]).map((row) => [
      row.client_id as string,
      row,
    ]),
  );
  const windows = (windowsRes.data ?? []) as Row[];
  const events = (eventsRes.data ?? []) as Row[];
  const topups = (topupsRes.data ?? []) as Row[];

  return ((clientsRes.data ?? []) as Row[]).map((client) => {
    const id = client.id as string;
    const account = accounts.get(id);
    const period = periods.get(id);
    const periodId = period?.id as string | undefined;
    const conversationCount = windows.filter(
      (row) => row.client_id === id && row.billing_period_id === periodId,
    ).length;
    const actionCount = events.filter(
      (row) =>
        row.client_id === id &&
        row.billing_period_id === periodId &&
        row.usage_type === "internal_ai_action",
    ).length;
    const activatedTopups = topups
      .filter(
        (row) => row.client_id === id && row.billing_period_id === periodId,
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.pack_quantity) * Number(row.units_per_pack),
        0,
      );
    const hasFinancialUsage = windows.some(
      (row) => row.client_id === id && row.metering_mode === "financial",
    );
    const lastMeasuredAt = events.find((row) => row.client_id === id)
      ?.occurred_at as string | undefined;

    let status: AiUsageOverview["status"] = "unmetered_legacy";
    if (account?.status === "suspended") status = "suspended";
    else if (account && !account.agreement_ref) status = "no_signed_agreement";
    else if (account && period)
      status = hasFinancialUsage ? "enforced" : "shadow";

    return {
      clientId: id,
      companyName: (client.name as string | null) ?? "Company",
      status,
      aiSku: (account?.ai_sku as string | null) ?? null,
      periodStart: (period?.period_start as string | null) ?? null,
      periodEnd: (period?.period_end as string | null) ?? null,
      conversations: period
        ? calculateQuota(
            Number(period.included_conversations),
            conversationCount,
            activatedTopups,
          )
        : null,
      actions: period
        ? calculateQuota(Number(period.included_ai_actions), actionCount)
        : null,
      lastMeasuredAt: lastMeasuredAt ?? null,
    };
  });
}

export async function loadClientAiUsage(
  clientId: string,
): Promise<AiUsageOverview | null> {
  return (await loadAiUsageOverviews(clientId))[0] ?? null;
}
