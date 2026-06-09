import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";

type SalespersonRow = {
  id: string;
  name: string;
  phone: string | null;
  client_id: string | null;
  notification_prefs: Record<string, unknown> | null;
};

type LeadForCoaching = {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  is_stale: boolean | null;
  follow_up_date: string | null;
  created_at: string;
};

function startOfYesterdayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function sendDailySalespersonCoaching(): Promise<void> {
  const supabase = createAdminClient();

  const { data: salespeople } = await supabase
    .from("users")
    .select("id, name, phone, client_id, notification_prefs")
    .eq("role", "SALESPERSON")
    .eq("is_active", true);

  if (!salespeople || salespeople.length === 0) return;

  for (const salesperson of salespeople as SalespersonRow[]) {
    try {
      const prefs = salesperson.notification_prefs;
      if (prefs?.daily_coaching === false) continue;
      if (!salesperson.phone) continue;

      await sendCoachingMessageToSalesperson(salesperson);
    } catch (err) {
      console.error(`[daily-coaching] Failed for salesperson ${salesperson.id}:`, err);
    }
  }
}

async function sendCoachingMessageToSalesperson(salesperson: SalespersonRow): Promise<void> {
  const supabase = createAdminClient();
  const yesterdayStart = startOfYesterdayUtc();
  const todayStart = startOfTodayUtc();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, status, score, is_stale, follow_up_date, created_at")
    .eq("assigned_to_id", salesperson.id)
    .not("status", "in", "(WON,LOST,NOT_QUALIFIED)")
    .order("score", { ascending: false, nullsFirst: false })
    .limit(10) as { data: LeadForCoaching[] | null };

  if (!leads || leads.length === 0) return;

  const leadIds = leads.map((l) => l.id);

  const { count: callsLogged } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", salesperson.id)
    .gte("created_at", yesterdayStart.toISOString())
    .lt("created_at", todayStart.toISOString());

  const { data: yesterdayCalls } = await supabase
    .from("call_logs")
    .select("lead_id, outcome")
    .eq("user_id", salesperson.id)
    .gte("created_at", yesterdayStart.toISOString())
    .lt("created_at", todayStart.toISOString());

  const advancedLeadIds = new Set(
    (yesterdayCalls ?? [])
      .filter((c) => (c.outcome as string) !== "NO_ANSWER")
      .map((c) => c.lead_id as string)
  );

  const { data: recentCalls } = await supabase
    .from("call_logs")
    .select("lead_id, outcome, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false })
    .limit(20);

  let clientName = "your company";
  if (salesperson.client_id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("name")
      .eq("id", salesperson.client_id)
      .maybeSingle();
    if (clientRow?.name) clientName = clientRow.name as string;
  }

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const leadsContext = leads
    .map((lead) => {
      const lastCall = recentCalls?.find((c) => c.lead_id === lead.id);
      const daysSinceLastCall = lastCall
        ? Math.round(
            (today.getTime() - new Date(lastCall.created_at as string).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const followUpDue =
        lead.follow_up_date && new Date(lead.follow_up_date) <= today;

      return `- ${lead.name ?? "Unknown"}: score ${lead.score ?? 0}/100, status ${lead.status}${
        lead.is_stale ? ", STALE (7+ days no activity)" : ""
      }${followUpDue ? ", FOLLOW-UP DUE TODAY" : ""}${
        daysSinceLastCall !== null
          ? `, last called ${daysSinceLastCall} days ago`
          : ", never called"
      }`;
    })
    .join("\n");

  const todaysFocus = await callClaude({
    system: `You are a sales coach writing one short priority line for a daily WhatsApp template variable.
Return a single sentence only — no greeting, no bullet points, under 120 characters.
Be specific about which leads or actions matter most today.`,
    userMessage: `Write today's focus for ${salesperson.name} at ${clientName} (${todayStr}).

Active leads:
${leadsContext}

Yesterday: ${callsLogged ?? 0} calls logged, ${advancedLeadIds.size} leads moved forward.`,
    maxTokens: 80,
  });

  await sendWhatsApp({
    to: salesperson.phone,
    template: "DAILY_COACHING",
    variables: {
      "1": firstName(salesperson.name),
      "2": String(callsLogged ?? 0),
      "3": String(advancedLeadIds.size),
      "4": todaysFocus.trim(),
    },
    fallbackBody: `Good morning ${firstName(salesperson.name)}. Yesterday: ${callsLogged ?? 0} calls, ${advancedLeadIds.size} leads advanced. Today: ${todaysFocus.trim()}`,
    context: {
      clientId: salesperson.client_id ?? undefined,
      notificationType: "DAILY_COACHING",
    },
  });
}
