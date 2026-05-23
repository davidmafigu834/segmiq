import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { weeklyDigestEmail } from "@/lib/email/templates/weekly-digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
  lastMonday.setHours(0, 0, 0, 0);

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  const weekRange = `${lastMonday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${lastSunday.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .eq("is_archived", false);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ success: true, sent: 0, weekRange });
  }

  let totalSent = 0;
  const errors: string[] = [];

  for (const client of clients) {
    try {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, status, assigned_to_id, created_at, deal_value, name")
        .eq("client_id", client.id as string)
        .gte("created_at", lastMonday.toISOString())
        .lte("created_at", lastSunday.toISOString());

      const leadsArr = leads ?? [];
      const leadIds = leadsArr.map((l) => l.id as string);

      const { data: callLogs } =
        leadIds.length > 0
          ? await supabase
              .from("call_logs")
              .select("lead_id, created_at")
              .in("lead_id", leadIds)
              .order("created_at", { ascending: true })
          : { data: [] };

      const leadsReceived = leadsArr.length;
      const leadsContacted = leadsArr.filter((l) => l.status !== "NEW").length;
      const contactRate =
        leadsReceived > 0 ? Math.round((leadsContacted / leadsReceived) * 100) : 0;
      const dealsWon = leadsArr.filter((l) => l.status === "WON").length;
      const dealsLost = leadsArr.filter((l) => l.status === "LOST").length;

      let avgResponseHours = 0;
      if (callLogs && callLogs.length > 0 && leadsArr.length > 0) {
        const responseTimes: number[] = [];
        for (const lead of leadsArr) {
          const firstCall = callLogs.find((c) => c.lead_id === lead.id);
          if (firstCall) {
            const diff =
              new Date(firstCall.created_at as string).getTime() -
              new Date(lead.created_at as string).getTime();
            responseTimes.push(diff / (1000 * 60 * 60));
          }
        }
        if (responseTimes.length > 0) {
          avgResponseHours =
            Math.round(
              (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10
            ) / 10;
        }
      }

      const { data: salespeople } = await supabase
        .from("users")
        .select("id, name")
        .eq("client_id", client.id as string)
        .eq("role", "SALESPERSON")
        .eq("is_active", true);

      const teamRows = (salespeople ?? []).map((sp) => {
        const spLeads = leadsArr.filter((l) => l.assigned_to_id === sp.id);
        return {
          name: sp.name as string,
          assigned: spLeads.length,
          contacted: spLeads.filter((l) => l.status !== "NEW").length,
          won: spLeads.filter((l) => l.status === "WON").length,
          lost: spLeads.filter((l) => l.status === "LOST").length,
        };
      });

      const wonLeads = leadsArr.filter((l) => l.status === "WON");
      let topLead: { name: string; salesperson: string; dealValue?: number } | null = null;
      if (wonLeads.length > 0) {
        const topWon = wonLeads.sort(
          (a, b) => ((b.deal_value as number) || 0) - ((a.deal_value as number) || 0)
        )[0];
        const sp = (salespeople ?? []).find((s) => s.id === topWon.assigned_to_id);
        topLead = {
          name: topWon.name as string,
          salesperson: (sp?.name as string) || "Unknown",
          dealValue: (topWon.deal_value as number) || undefined,
        };
      }

      const { data: managers } = await supabase
        .from("users")
        .select("id, name, email, notification_prefs")
        .eq("client_id", client.id as string)
        .eq("role", "CLIENT_MANAGER")
        .eq("is_active", true);

      if (!managers || managers.length === 0) continue;

      for (const manager of managers) {
        const prefs = manager.notification_prefs as Record<string, unknown> | null;
        if (prefs?.weekly_digest === false) continue;

        const { subject, html } = weeklyDigestEmail({
          managerName: manager.name as string,
          clientName: client.name as string,
          weekRange,
          stats: { leadsReceived, leadsContacted, contactRate, dealsWon, dealsLost, avgResponseHours },
          teamRows,
          topLead,
        });

        const result = await sendEmail({
          to: manager.email as string,
          subject,
          html,
        });

        if (result.success) {
          totalSent++;
        } else {
          errors.push(`Failed to send to ${manager.email}: ${result.error}`);
        }
      }
    } catch (err) {
      errors.push(`Error processing client ${client.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    sent: totalSent,
    weekRange,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
