import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { countPaidSeats, type Catalogue } from "@/lib/commercial/catalogue";
import {
  buildMigrationCandidate,
  type LegacyMigrationSource,
  type MigrationCandidate,
} from "@/lib/commercial/migration";

type Row = Record<string, unknown>;

export async function loadMigrationCandidates(
  catalogue: Catalogue,
  now = new Date(),
): Promise<MigrationCandidate[]> {
  const db = createAdminClient();
  const [clientsResult, subscriptionsResult, usersResult, accountsResult] =
    await Promise.all([
      db.from("clients").select("id, name, is_active").order("name"),
      db
        .from("subscriptions")
        .select(
          "id, client_id, plan, amount, currency, status, billing_cycle, current_period_end, created_at",
        )
        .eq("product", "crm")
        .order("created_at", { ascending: false }),
      db.from("users").select("id, client_id, role, is_active"),
      db.from("platform_commercial_accounts").select("client_id"),
    ]);
  for (const result of [
    clientsResult,
    subscriptionsResult,
    usersResult,
    accountsResult,
  ]) {
    if (result.error)
      throw new Error(`Migration queue unavailable: ${result.error.message}`);
  }

  const migrated = new Set(
    ((accountsResult.data ?? []) as Row[]).map((row) => String(row.client_id)),
  );
  const clients = new Map(
    ((clientsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const latestSubscriptions = new Map<string, Row>();
  for (const row of (subscriptionsResult.data ?? []) as Row[]) {
    const clientId = String(row.client_id);
    if (!latestSubscriptions.has(clientId)) latestSubscriptions.set(clientId, row);
  }
  const usersByClient = new Map<string, Row[]>();
  for (const row of (usersResult.data ?? []) as Row[]) {
    const clientId = row.client_id ? String(row.client_id) : "";
    if (!clientId) continue;
    usersByClient.set(clientId, [...(usersByClient.get(clientId) ?? []), row]);
  }

  const candidates: MigrationCandidate[] = [];
  for (const [clientId, subscription] of latestSubscriptions) {
    if (migrated.has(clientId)) continue;
    const client = clients.get(clientId);
    if (!client) continue;
    const activeUsers = countPaidSeats(
      (usersByClient.get(clientId) ?? []).map((user) => ({
        userId: String(user.id),
        active: Boolean(user.is_active),
        role: String(user.role),
      })),
    );
    const source: LegacyMigrationSource = {
      clientId,
      clientName: String(client.name),
      subscriptionId: String(subscription.id),
      legacyPlan: String(subscription.plan),
      amount: Number(subscription.amount),
      currency: String(subscription.currency),
      billingCycle:
        subscription.billing_cycle === "annual" ? "annual" : "monthly",
      status: String(subscription.status),
      currentPeriodEnd: subscription.current_period_end
        ? String(subscription.current_period_end)
        : null,
      activeUsers,
    };
    candidates.push(buildMigrationCandidate(catalogue, source, now));
  }
  return candidates.sort((left, right) =>
    left.clientName.localeCompare(right.clientName),
  );
}
