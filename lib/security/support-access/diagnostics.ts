/**
 * Operational diagnostics for one organisation.
 *
 * This is the data a SegmiQ platform administrator sees WITHOUT Support Access:
 * counts, health states, error codes and timestamps. It deliberately contains
 * no customer names, phone numbers, message bodies, document contents, or
 * integration secrets — most support issues are solvable from this alone.
 *
 * Every metric degrades to null when its table or column is unavailable so a
 * schema difference can never take the platform console down.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationHealth = {
  key: "whatsapp" | "facebook" | "instagram" | "website";
  label: string;
  status: "connected" | "attention_required" | "disconnected" | "not_configured";
  statusLabel: string;
  lastSyncAt: string | null;
  lastEventAt: string | null;
  errorCode: string | null;
  errorCount: number;
};

export type OrganisationDiagnostics = {
  organisation: {
    id: string;
    name: string;
    industry: string | null;
    status: "active" | "suspended" | "archived";
    plan: string | null;
    subscriptionStatus: string | null;
    createdAt: string | null;
    mode: string | null;
    agencyManaged: boolean;
    lastActivityAt: string | null;
    primaryAdministrator: { id: string; name: string | null; role: string } | null;
  };
  usage: {
    activeUsers: number | null;
    totalUsers: number | null;
    leads: number | null;
    deals: number | null;
    contacts: number | null;
    quotations: number | null;
    documents: number | null;
    agentRunsThisMonth: number | null;
    messagesThisMonth: number | null;
  };
  integrations: IntegrationHealth[];
  platformHealth: {
    agentRunsToday: number | null;
    agentFailuresToday: number | null;
    agentLastRunAt: string | null;
    agentLastFailureCode: string | null;
    failedOutboundMessages: number | null;
    webhookFailures: number | null;
  };
  security: {
    usersWithMfa: number | null;
    activeSessions: number | null;
    securityEvents7d: number | null;
    failedLogins7d: number | null;
    activeSupportAccess: number | null;
    supportAccessSessions30d: number | null;
  };
};

async function count(
  table: string,
  build: (q: ReturnType<ReturnType<typeof createAdminClient>["from"]>) => unknown
): Promise<number | null> {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = build(supabase.from(table) as any) as Promise<{
      count: number | null;
      error: unknown;
    }>;
    const { count: value, error } = await query;
    if (error) return null;
    return value ?? 0;
  } catch {
    return null;
  }
}

function countFor(table: string, clientId: string, extra?: (q: any) => any) {
  return count(table, (t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (t as any).select("id", { count: "exact", head: true }).eq("client_id", clientId);
    if (extra) q = extra(q);
    return q;
  });
}

function statusLabelFor(status: IntegrationHealth["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "attention_required":
      return "Action required";
    case "disconnected":
      return "Disconnected";
    default:
      return "Not configured";
  }
}

async function whatsappHealth(clientId: string): Promise<IntegrationHealth> {
  const base: IntegrationHealth = {
    key: "whatsapp",
    label: "WhatsApp",
    status: "not_configured",
    statusLabel: "Not configured",
    lastSyncAt: null,
    lastEventAt: null,
    errorCode: null,
    errorCount: 0,
  };
  try {
    const supabase = createAdminClient();
    // SECURITY: session_ciphertext / auth state columns are never selected here.
    const { data } = await supabase
      .from("whatsapp_connections")
      .select("status, connected_at, last_seen_at, last_error_code")
      .eq("client_id", clientId)
      .eq("is_primary", true)
      .maybeSingle();
    if (!data) return base;
    const raw = String(data.status ?? "").toUpperCase();
    const status: IntegrationHealth["status"] =
      raw === "CONNECTED"
        ? "connected"
        : raw === "DISCONNECTED" || raw === "LOGGED_OUT"
          ? "disconnected"
          : "attention_required";
    return {
      ...base,
      status,
      statusLabel: statusLabelFor(status),
      lastSyncAt: (data.connected_at as string | null) ?? null,
      lastEventAt: (data.last_seen_at as string | null) ?? null,
      errorCode: (data.last_error_code as string | null) ?? null,
    };
  } catch {
    return base;
  }
}

async function socialHealth(clientId: string): Promise<IntegrationHealth[]> {
  const blank = (
    key: "facebook" | "instagram",
    label: string
  ): IntegrationHealth => ({
    key,
    label,
    status: "not_configured",
    statusLabel: "Not configured",
    lastSyncAt: null,
    lastEventAt: null,
    errorCode: null,
    errorCount: 0,
  });

  const out: IntegrationHealth[] = [blank("facebook", "Meta / Facebook"), blank("instagram", "Instagram")];
  try {
    const supabase = createAdminClient();
    // SECURITY: token_sealed is never selected.
    const { data } = await supabase
      .from("social_channel_connections")
      .select("provider, status, last_sync_at, last_event_at, last_error")
      .eq("client_id", clientId);
    for (const row of data ?? []) {
      const provider = String(row.provider) === "instagram" ? "instagram" : "facebook";
      const idx = out.findIndex((i) => i.key === provider);
      if (idx < 0) continue;
      const raw = String(row.status ?? "");
      const status: IntegrationHealth["status"] =
        raw === "connected"
          ? "connected"
          : raw === "disconnected"
            ? "disconnected"
            : "attention_required";
      out[idx] = {
        ...out[idx]!,
        status,
        statusLabel: statusLabelFor(status),
        lastSyncAt: (row.last_sync_at as string | null) ?? null,
        lastEventAt: (row.last_event_at as string | null) ?? null,
        // Error codes only — provider error text can quote customer content.
        errorCode: row.last_error ? "PROVIDER_ERROR" : null,
        errorCount: row.last_error ? 1 : 0,
      };
    }
  } catch {
    // Keep the not-configured defaults.
  }
  return out;
}

async function websiteHealth(clientId: string): Promise<IntegrationHealth> {
  try {
    const supabase = createAdminClient();
    // SECURITY: only the presence of a hashed key is read, never the key itself.
    const { data } = await supabase
      .from("clients")
      .select("website_integration_api_key_hash")
      .eq("id", clientId)
      .maybeSingle();
    const configured = Boolean(data?.website_integration_api_key_hash);
    return {
      key: "website",
      label: "Website lead capture",
      status: configured ? "connected" : "not_configured",
      statusLabel: statusLabelFor(configured ? "connected" : "not_configured"),
      lastSyncAt: null,
      lastEventAt: null,
      errorCode: null,
      errorCount: 0,
    };
  } catch {
    return {
      key: "website",
      label: "Website lead capture",
      status: "not_configured",
      statusLabel: "Not configured",
      lastSyncAt: null,
      lastEventAt: null,
      errorCode: null,
      errorCount: 0,
    };
  }
}

async function agentHealth(clientId: string, monthStart: string, dayStart: string) {
  const supabase = createAdminClient();
  let lastRunAt: string | null = null;
  let lastFailureCode: string | null = null;
  try {
    const { data } = await supabase
      .from("agent_executions")
      .select("created_at, state, error_code")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = data ?? [];
    lastRunAt = (rows[0]?.created_at as string | null) ?? null;
    lastFailureCode =
      (rows.find((r) => String(r.state) === "FAILED")?.error_code as string | null) ?? null;
  } catch {
    // Leave nulls.
  }

  const [runsToday, failuresToday, runsThisMonth] = await Promise.all([
    countFor("agent_executions", clientId, (q) => q.gte("created_at", dayStart)),
    countFor("agent_executions", clientId, (q) =>
      q.gte("created_at", dayStart).eq("state", "FAILED")
    ),
    countFor("agent_executions", clientId, (q) => q.gte("created_at", monthStart)),
  ]);

  return { runsToday, failuresToday, runsThisMonth, lastRunAt, lastFailureCode };
}

export async function fetchOrganisationDiagnostics(
  clientId: string
): Promise<OrganisationDiagnostics | null> {
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, industry, is_active, is_archived, created_at, mode, agency_managed, security_suspended_at")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [
    totalUsers,
    activeUsers,
    leads,
    deals,
    contacts,
    quotations,
    documents,
    messagesThisMonth,
    agent,
    whatsapp,
    social,
    website,
    activeSessions,
    securityEvents7d,
    failedLogins7d,
    activeSupportAccess,
    supportAccessSessions30d,
  ] = await Promise.all([
    countFor("users", clientId),
    countFor("users", clientId, (q) => q.eq("is_active", true)),
    countFor("leads", clientId),
    countFor("deals", clientId),
    countFor("contacts", clientId),
    countFor("quotations", clientId),
    countFor("documents", clientId),
    countFor("whatsapp_messages", clientId, (q) => q.gte("created_at", monthStart)),
    agentHealth(clientId, monthStart, dayStart),
    whatsappHealth(clientId),
    socialHealth(clientId),
    websiteHealth(clientId),
    countFor("user_sessions", clientId, (q) => q.is("revoked_at", null)),
    countFor("security_events", clientId, (q) => q.gte("created_at", weekAgo)),
    countFor("security_events", clientId, (q) =>
      q.gte("created_at", weekAgo).eq("event_type", "LOGIN_FAILED")
    ),
    countFor("support_access_grants", clientId, (q) => q.eq("status", "ACTIVE")),
    countFor("support_access_grants", clientId, (q) => q.gte("requested_at", monthAgo)),
  ]);

  let usersWithMfa: number | null = null;
  let primaryAdministrator: OrganisationDiagnostics["organisation"]["primaryAdministrator"] = null;
  let lastActivityAt: string | null = null;
  try {
    const { data: staff } = await supabase
      .from("users")
      .select("id, name, role, is_active, created_at")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    const rows = staff ?? [];
    const manager = rows.find((u) => String(u.role) === "CLIENT_MANAGER") ?? rows[0] ?? null;
    if (manager) {
      primaryAdministrator = {
        id: manager.id as string,
        name: (manager.name as string | null) ?? null,
        role: String(manager.role),
      };
    }
    const ids = rows.map((u) => u.id as string);
    if (ids.length) {
      const { count: mfaCount } = await supabase
        .from("user_mfa_methods")
        .select("user_id", { count: "exact", head: true })
        .in("user_id", ids)
        .eq("status", "active");
      usersWithMfa = mfaCount ?? 0;

      const { data: session } = await supabase
        .from("user_sessions")
        .select("last_seen_at")
        .in("user_id", ids)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastActivityAt = (session?.last_seen_at as string | null) ?? null;
    }
  } catch {
    // Leave nulls.
  }

  let plan: string | null = null;
  let subscriptionStatus: string | null = null;
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, plan, product")
      .eq("client_id", clientId)
      .eq("product", "crm")
      .limit(1)
      .maybeSingle();
    plan = (sub?.plan as string | null) ?? null;
    subscriptionStatus = (sub?.status as string | null) ?? null;
  } catch {
    // Leave nulls.
  }

  const status: OrganisationDiagnostics["organisation"]["status"] =
    client.is_archived === true
      ? "archived"
      : client.security_suspended_at || client.is_active === false
        ? "suspended"
        : "active";

  return {
    organisation: {
      id: client.id as string,
      name: client.name as string,
      industry: (client.industry as string | null) ?? null,
      status,
      plan,
      subscriptionStatus,
      createdAt: (client.created_at as string | null) ?? null,
      mode: (client.mode as string | null) ?? null,
      agencyManaged: Boolean(client.agency_managed ?? true),
      lastActivityAt,
      primaryAdministrator,
    },
    usage: {
      activeUsers,
      totalUsers,
      leads,
      deals,
      contacts,
      quotations,
      documents,
      agentRunsThisMonth: agent.runsThisMonth,
      messagesThisMonth,
    },
    integrations: [whatsapp, ...social, website],
    platformHealth: {
      agentRunsToday: agent.runsToday,
      agentFailuresToday: agent.failuresToday,
      agentLastRunAt: agent.lastRunAt,
      agentLastFailureCode: agent.lastFailureCode,
      failedOutboundMessages: await countFor("whatsapp_messages", clientId, (q) =>
        q.gte("created_at", dayStart).eq("status", "FAILED")
      ),
      webhookFailures: await countFor("security_events", clientId, (q) =>
        q.gte("created_at", weekAgo).eq("event_type", "INTEGRATION_AUTH_FAILED")
      ),
    },
    security: {
      usersWithMfa,
      activeSessions,
      securityEvents7d,
      failedLogins7d,
      activeSupportAccess,
      supportAccessSessions30d,
    },
  };
}
