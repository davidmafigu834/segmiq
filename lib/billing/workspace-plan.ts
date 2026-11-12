import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { workspacePlanBadge, type WorkspacePlanBadge } from "@/lib/billing/workspace-plan-badge";

type PlanRow = { plan: string | null; status: string | null; periodEnd: string | null };

function asRow(value: Record<string, unknown> | null, planKey: string, endKey: string): PlanRow | null {
  if (!value) return null;
  return {
    plan: value[planKey] == null ? null : String(value[planKey]),
    status: value.status == null ? null : String(value.status),
    periodEnd: value[endKey] == null ? null : String(value[endKey]),
  };
}

export async function loadWorkspacePlanBadge(clientId: string | null | undefined): Promise<WorkspacePlanBadge | null> {
  if (!clientId) return null;
  try {
    const db = createAdminClient();
    const [subscription, account, invoices, client] = await Promise.all([
      db
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("client_id", clientId)
        .eq("product", "crm")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("platform_commercial_accounts")
        .select("crm_sku, ai_sku, status, renewal_at")
        .eq("client_id", clientId)
        .maybeSingle(),
      db.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "overdue"),
      db.from("clients").select("plan").eq("id", clientId).maybeSingle(),
    ]);

    const invoiceOverdue = !invoices.error && (invoices.count ?? 0) > 0;
    const commercial = !account.error
      ? asRow(
          account.data
            ? {
                plan: account.data.ai_sku || account.data.crm_sku,
                status: account.data.status,
                renewal_at: account.data.renewal_at,
              }
            : null,
          "plan",
          "renewal_at"
        )
      : null;
    const legacy = !subscription.error
      ? asRow(
          subscription.data
            ? {
                plan: subscription.data.plan,
                status: subscription.data.status,
                current_period_end: subscription.data.current_period_end,
              }
            : null,
          "plan",
          "current_period_end"
        )
      : null;
    const chosen = commercial?.plan ? commercial : legacy;
    if (chosen) {
      return workspacePlanBadge({ ...chosen, invoiceOverdue });
    }
    const fallback = !client.error && client.data?.plan ? String(client.data.plan) : null;
    if (!fallback && !invoiceOverdue) return null;
    return workspacePlanBadge({
      plan: fallback,
      status: invoiceOverdue ? "past_due" : "active",
      periodEnd: null,
      invoiceOverdue,
    });
  } catch {
    return null;
  }
}
