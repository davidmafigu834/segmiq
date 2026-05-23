import { createAdminClient } from "@/lib/supabase/admin";

type ScoreBreakdown = {
  recency: number;
  calls: number;
  assets_sent: number;
  status_progress: number;
  budget: number;
  source: number;
};

type ScoredLead = {
  leadId: string;
  score: number;
  breakdown: ScoreBreakdown;
  isStale: boolean;
  staleSince?: string;
};

export async function scoreLead(leadId: string): Promise<ScoredLead> {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, status, source, created_at, follow_up_date, deal_value, form_data, client_id")
    .eq("id", leadId)
    .single();

  if (!lead) throw new Error("Lead not found");

  const now = new Date();
  const createdAt = new Date(lead.created_at as string);
  const daysActive = Math.round(
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("outcome, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const { data: events } = await supabase
    .from("lead_events")
    .select("event_type, event_data, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const calls = callLogs ?? [];
  const evts = events ?? [];

  // ============================================
  // SCORING COMPONENTS — max 100 total
  // ============================================

  // 1. RECENCY — max 20 points
  const lastActivity = evts.length > 0 ? new Date(evts[0].created_at as string) : createdAt;
  const daysSinceActivity = Math.round(
    (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  let recencyScore = 20;
  if (daysSinceActivity > 30) recencyScore = 0;
  else if (daysSinceActivity > 14) recencyScore = 5;
  else if (daysSinceActivity > 7) recencyScore = 10;
  else if (daysSinceActivity > 3) recencyScore = 15;

  // 2. CALLS — max 20 points
  const answeredCalls = calls.filter((c) => c.outcome === "ANSWERED").length;
  const totalCalls = calls.length;

  let callScore = 0;
  if (answeredCalls >= 3) callScore = 20;
  else if (answeredCalls === 2) callScore = 15;
  else if (answeredCalls === 1) callScore = 10;
  else if (totalCalls > 0) callScore = 5;

  // 3. ASSETS SENT — max 15 points
  const documentEvents = evts.filter((e) => e.event_type === "DOCUMENT_SENT");
  const portfolioSent = documentEvents.some(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "PORTFOLIO"
  );
  const pricingSent = documentEvents.some(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "PRICING_PACKAGE"
  );

  let assetScore = 0;
  if (portfolioSent) assetScore += 5;
  if (pricingSent) assetScore += 7;
  if (documentEvents.length > 0 && assetScore === 0) assetScore += 3;
  assetScore = Math.min(assetScore, 15);

  // 4. STATUS PROGRESS — max 25 points
  const statusScores: Record<string, number> = {
    NEW: 0,
    CONTACTED: 8,
    QUALIFIED: 15,
    NEGOTIATING: 25,
    PROPOSAL_SENT: 20,
    WON: 25,
    LOST: 0,
    NOT_QUALIFIED: 0,
  };
  const statusScore = statusScores[lead.status as string] ?? 0;

  // 5. BUDGET — max 10 points
  let budgetScore = 0;
  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const budget =
    (lead.deal_value as number | null) ??
    (formData.budget as string | undefined) ??
    (formData.budget_range as string | undefined);

  if (budget) {
    const numBudget =
      typeof budget === "number"
        ? budget
        : parseFloat(String(budget).replace(/[^0-9.]/g, ""));

    if (!isNaN(numBudget)) {
      if (numBudget >= 50000) budgetScore = 10;
      else if (numBudget >= 20000) budgetScore = 8;
      else if (numBudget >= 10000) budgetScore = 6;
      else if (numBudget >= 5000) budgetScore = 4;
      else budgetScore = 2;
    }
  }

  // 6. SOURCE QUALITY — max 10 points
  const sourceScores: Record<string, number> = {
    REFERRAL: 10,
    LANDING_PAGE: 7,
    FACEBOOK: 5,
    MANUAL: 8,
  };
  const sourceScore = sourceScores[lead.source as string] ?? 5;

  const breakdown: ScoreBreakdown = {
    recency: recencyScore,
    calls: callScore,
    assets_sent: assetScore,
    status_progress: statusScore,
    budget: budgetScore,
    source: sourceScore,
  };

  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  // Stale detection
  const isActiveStatus = !["WON", "LOST", "NOT_QUALIFIED"].includes(lead.status as string);
  const isStale = isActiveStatus && daysSinceActivity >= 7 && daysActive >= 3;
  const staleSince = isStale
    ? new Date(lastActivity.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  return { leadId, score, breakdown, isStale, staleSince };
}

export async function scoreAllLeadsForClient(clientId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", clientId)
    .not("status", "in", "(WON,LOST,NOT_QUALIFIED)");

  if (!leads || leads.length === 0) return;

  for (const lead of leads) {
    try {
      const result = await scoreLead(lead.id as string);

      await supabase
        .from("leads")
        .update({
          score: result.score,
          score_breakdown: result.breakdown,
          score_updated_at: new Date().toISOString(),
          is_stale: result.isStale,
          stale_since: result.staleSince ?? null,
        })
        .eq("id", lead.id as string);
    } catch (err) {
      console.error(`[lead-scoring] Scoring failed for lead ${lead.id as string}:`, err);
    }
  }
}

export async function scoreAllLeads(): Promise<void> {
  const supabase = createAdminClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false);

  if (!clients) return;

  for (const client of clients) {
    await scoreAllLeadsForClient(client.id as string);
  }
}
