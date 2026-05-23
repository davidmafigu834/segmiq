import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import { sendWhatsApp } from "@/lib/messaging/provider";

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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, status, score, is_stale, follow_up_date, created_at")
    .eq("assigned_to_id", salesperson.id)
    .not("status", "in", "(WON,LOST,NOT_QUALIFIED)")
    .order("score", { ascending: false, nullsFirst: false })
    .limit(10) as { data: LeadForCoaching[] | null };

  if (!leads || leads.length === 0) return;

  const leadIds = leads.map((l) => l.id);
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

  const coaching = await callClaude({
    system: `You are a sales coach sending a daily WhatsApp message to a salesperson.
Write a brief, practical daily briefing — like a message from their manager.
Keep it under 200 words.
Use plain text only — no markdown, no bullet points that use hyphens or asterisks, no headers.
Use simple line breaks between sections.
Be encouraging but direct.
Structure:
1. Good morning greeting with their name and today's date
2. Their top 2-3 priorities for today — be specific about which leads and why
3. One practical tip based on what you see in their pipeline
End with a short motivating sign-off.
Do not mention scores directly — translate them into plain language about priority.`,
    userMessage: `Write a daily coaching WhatsApp message for ${salesperson.name} at ${clientName}.

Today is ${todayStr}.

Their active leads (${leads.length} total):
${leadsContext}

Generate a practical daily briefing telling them their priorities for today.`,
    maxTokens: 300,
  });

  await sendWhatsApp({
    to: salesperson.phone,
    template: "DAILY_COACHING",
    variables: {
      "1": salesperson.name,
      "2": coaching,
    },
    fallbackBody: coaching,
    context: {
      clientId: salesperson.client_id ?? undefined,
      notificationType: "DAILY_COACHING",
    },
  });
}
