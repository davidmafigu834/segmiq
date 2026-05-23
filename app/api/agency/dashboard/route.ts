import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Get all active clients
  const { data: clients } = await supabase
    .from("clients")
    .select(
      "id, name, industry, is_active, response_time_limit_hours, fb_access_token, fb_token_expired_at, fb_page_id, send_prospect_confirmation"
    )
    .eq("is_active", true)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (!clients || clients.length === 0) {
    return NextResponse.json({
      pulse: {
        totalClients: 0,
        leadsThisWeek: 0,
        dealsWonThisWeek: 0,
        avgContactRate: 0,
      },
      clients: [],
      alerts: [],
      recentActivity: [],
    });
  }

  const clientIds = clients.map((c) => c.id as string);

  // Get leads for this week across all clients
  const { data: weekLeads } = await supabase
    .from("leads")
    .select("id, client_id, status, created_at, assigned_to_id")
    .in("client_id", clientIds)
    .gte("created_at", weekStart.toISOString());

  // Get stale leads count per client
  const { data: staleLeads } = await supabase
    .from("leads")
    .select("id, client_id")
    .in("client_id", clientIds)
    .eq("is_stale", true);

  // Get all active salespeople per client
  const { data: salespeople } = await supabase
    .from("users")
    .select("id, client_id, name, is_active")
    .in("client_id", clientIds)
    .eq("role", "SALESPERSON")
    .eq("is_active", true);

  // Get recent activity across all clients
  const { data: recentEvents } = await supabase
    .from("lead_events")
    .select("id, event_type, actor_name, event_data, created_at, client_id, leads(name, client_id)")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false })
    .limit(20);

  // Build per-client stats
  const clientStats = clients.map((client) => {
    const cLeads = (weekLeads ?? []).filter((l) => l.client_id === client.id);
    const cStale = (staleLeads ?? []).filter((s) => s.client_id === client.id).length;
    const cSalespeople = (salespeople ?? []).filter((s) => s.client_id === client.id).length;

    const leadsThisWeek = cLeads.length;
    const contacted = cLeads.filter((l) => l.status !== "NEW").length;
    const won = cLeads.filter((l) => l.status === "WON").length;
    const contactRate = leadsThisWeek > 0 ? Math.round((contacted / leadsThisWeek) * 100) : null;

    // Facebook status
    const fbConnected = !!client.fb_page_id && !!client.fb_access_token;
    const fbExpiredDate = client.fb_token_expired_at
      ? new Date(client.fb_token_expired_at as string)
      : null;
    const fbExpired = fbExpiredDate !== null && fbExpiredDate < now;
    const fbExpiringSoon =
      fbExpiredDate !== null &&
      !fbExpired &&
      fbExpiredDate > now &&
      fbExpiredDate < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Alerts for this client
    const clientAlerts: string[] = [];
    if (fbExpired) clientAlerts.push("Facebook token expired");
    if (fbExpiringSoon) clientAlerts.push("Facebook token expiring soon");
    if (cStale > 5) clientAlerts.push(`${cStale} stale leads`);
    if (contactRate !== null && contactRate < 30) clientAlerts.push("Contact rate below 30%");
    if (leadsThisWeek === 0) clientAlerts.push("No leads this week");

    return {
      id: client.id as string,
      name: client.name as string,
      industry: (client.industry as string) || "",
      leadsThisWeek,
      contactRate,
      dealsWon: won,
      staleLeads: cStale,
      salespeopleCount: cSalespeople,
      fbConnected,
      fbExpired,
      fbExpiringSoon,
      alerts: clientAlerts,
      hasAlerts: clientAlerts.length > 0,
    };
  });

  // Agency-wide pulse
  const totalLeadsThisWeek = (weekLeads ?? []).length;
  const totalContactedThisWeek = (weekLeads ?? []).filter((l) => l.status !== "NEW").length;
  const totalWonThisWeek = (weekLeads ?? []).filter((l) => l.status === "WON").length;
  const avgContactRate =
    totalLeadsThisWeek > 0
      ? Math.round((totalContactedThisWeek / totalLeadsThisWeek) * 100)
      : 0;

  // Global alerts
  const globalAlerts = clientStats
    .filter((c) => c.hasAlerts)
    .flatMap((c) =>
      c.alerts.map((alert) => ({
        clientId: c.id,
        clientName: c.name,
        message: alert,
        severity: (
          alert.includes("expired") || alert.includes("stale") ? "error" : "warning"
        ) as "error" | "warning",
      }))
    )
    .slice(0, 10);

  return NextResponse.json({
    pulse: {
      totalClients: clients.length,
      leadsThisWeek: totalLeadsThisWeek,
      dealsWonThisWeek: totalWonThisWeek,
      avgContactRate,
    },
    clients: clientStats,
    alerts: globalAlerts,
    recentActivity: (recentEvents ?? []).slice(0, 15),
  });
}
