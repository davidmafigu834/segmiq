import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import crypto from "crypto";

// ============================================
// TYPES
// ============================================

type SourcePerf = {
  count: number;
  contacted: number;
  contact_rate: number;
  won: number;
};

type SalespersonPerf = {
  name: string;
  assigned: number;
  contacted: number;
  won: number;
  calls_logged: number;
  sends: number;
  avg_response_hours: number | null;
};

type PerformanceData = {
  clientId: string;
  clientName: string;
  industry: string;
  weekStart: Date;
  weekEnd: Date;

  // Volume
  totalLeads: number;
  newLeads: number;

  // Contact metrics
  contactRatePct: number | null;
  avgResponseTimeHours: number | null;

  // Source breakdown
  sourcePerformance: Record<string, SourcePerf>;

  // Salesperson breakdown
  salespersonPerformance: Record<string, SalespersonPerf>;

  // Send panel
  assetsSentTotal: number;
  assetsSentPerLead: number;

  // Stale
  staleLeadCount: number;
  staleLeadPct: number;

  // Conversion
  dealsWon: number;
  winRatePct: number | null;
  avgDaysToClose: number | null;

  // Intelligence
  avgIntentScore: number | null;
  highIntentLeads: number;
  highIntentContactRate: number | null;

  // Follow-up
  leadsWithFollowupPct: number;
  overdueFollowups: number;
};

// ============================================
// DATA COLLECTION
// ============================================

export async function collectPerformanceData(
  clientId: string
): Promise<PerformanceData | null> {
  const supabase = createAdminClient();

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Get client info
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, industry")
    .eq("id", clientId)
    .single();

  if (!client) return null;

  // All active leads — fetched first so we can use the ids
  const { data: allLeads } = await supabase
    .from("leads")
    .select("id, status, source, assigned_to_id, created_at, follow_up_date, is_stale, score")
    .eq("client_id", clientId)
    .eq("is_archived", false);

  const leads = allLeads ?? [];
  const allLeadIds = leads.map((l) => l.id as string);

  // Run remaining queries in parallel — guard the .in() call against empty arrays
  const [
    { data: weekLeads },
    { data: callLogs },
    { data: sentEvents },
    { data: salespeople },
    { data: winData },
    { data: intelligenceData },
  ] = await Promise.all([
    // Leads created this week
    supabase
      .from("leads")
      .select("id, status, source, assigned_to_id, created_at, is_stale")
      .eq("client_id", clientId)
      .eq("is_archived", false)
      .gte("created_at", weekStart.toISOString()),

    // All call logs for this week — only if there are leads to filter on
    allLeadIds.length > 0
      ? supabase
          .from("call_logs")
          .select("id, lead_id, user_id, outcome, created_at")
          .in("lead_id", allLeadIds)
          .gte("created_at", weekStart.toISOString())
      : Promise.resolve({ data: [] }),

    // Assets sent this week (lead_events with actor_id)
    supabase
      .from("lead_events")
      .select("id, actor_id, event_data, created_at")
      .eq("client_id", clientId)
      .eq("event_type", "DOCUMENT_SENT")
      .gte("created_at", weekStart.toISOString()),

    // Active salespeople
    supabase
      .from("users")
      .select("id, name")
      .eq("client_id", clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true),

    // Win analysis this week
    supabase
      .from("win_analysis")
      .select("days_to_close, deal_value, salesperson_id")
      .eq("client_id", clientId)
      .gte("created_at", weekStart.toISOString()),

    // Intelligence data for leads created this week
    supabase
      .from("lead_intelligence")
      .select("lead_id, intent_score, urgency_level, budget_estimate_usd")
      .eq("client_id", clientId)
      .gte("created_at", weekStart.toISOString()),
  ]);

  const wLeads = weekLeads ?? [];
  const calls = callLogs ?? [];
  const sends = sentEvents ?? [];
  const reps = salespeople ?? [];
  const wins = winData ?? [];
  const intel = intelligenceData ?? [];

  // ============================================
  // CONTACT RATE
  // ============================================

  const contactedThisWeek = wLeads.filter((l) => l.status !== "NEW").length;

  const contactRatePct =
    wLeads.length > 0
      ? Math.round((contactedThisWeek / wLeads.length) * 100)
      : null;

  // ============================================
  // AVERAGE RESPONSE TIME
  // Time from lead creation to first call log
  // ============================================

  const responseTimes: number[] = [];

  for (const lead of wLeads) {
    const firstCall = calls
      .filter((c) => c.lead_id === lead.id)
      .sort(
        (a, b) =>
          new Date(a.created_at as string).getTime() -
          new Date(b.created_at as string).getTime()
      )[0];

    if (firstCall) {
      const diffHours =
        (new Date(firstCall.created_at as string).getTime() -
          new Date(lead.created_at as string).getTime()) /
        (1000 * 60 * 60);

      if (diffHours >= 0 && diffHours < 168) {
        responseTimes.push(diffHours);
      }
    }
  }

  const avgResponseTimeHours =
    responseTimes.length > 0
      ? Math.round(
          (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) *
            10
        ) / 10
      : null;

  // ============================================
  // SOURCE PERFORMANCE
  // ============================================

  const sourcePerformance: Record<string, SourcePerf> = {};

  for (const lead of wLeads) {
    const src = (lead.source as string) || "UNKNOWN";
    if (!sourcePerformance[src]) {
      sourcePerformance[src] = { count: 0, contacted: 0, contact_rate: 0, won: 0 };
    }
    sourcePerformance[src].count++;
    if (lead.status !== "NEW") sourcePerformance[src].contacted++;
    if (lead.status === "WON") sourcePerformance[src].won++;
  }

  Object.keys(sourcePerformance).forEach((src) => {
    const sp = sourcePerformance[src];
    sp.contact_rate =
      sp.count > 0 ? Math.round((sp.contacted / sp.count) * 100) : 0;
  });

  // ============================================
  // SALESPERSON PERFORMANCE
  // ============================================

  const salespersonPerformance: Record<string, SalespersonPerf> = {};

  for (const rep of reps) {
    const repId = rep.id as string;
    const repLeads = wLeads.filter((l) => l.assigned_to_id === repId);
    const repCalls = calls.filter((c) => c.user_id === repId);
    const repSends = sends.filter((s) => s.actor_id === repId);

    const repContactedLeads = repLeads.filter((l) => l.status !== "NEW");
    const repWonLeads = repLeads.filter((l) => l.status === "WON");

    const repResponseTimes: number[] = [];
    for (const lead of repLeads) {
      const firstCall = repCalls
        .filter((c) => c.lead_id === lead.id)
        .sort(
          (a, b) =>
            new Date(a.created_at as string).getTime() -
            new Date(b.created_at as string).getTime()
        )[0];

      if (firstCall) {
        const diffHours =
          (new Date(firstCall.created_at as string).getTime() -
            new Date(lead.created_at as string).getTime()) /
          (1000 * 60 * 60);
        if (diffHours >= 0 && diffHours < 168) {
          repResponseTimes.push(diffHours);
        }
      }
    }

    salespersonPerformance[repId] = {
      name: rep.name as string,
      assigned: repLeads.length,
      contacted: repContactedLeads.length,
      won: repWonLeads.length,
      calls_logged: repCalls.length,
      sends: repSends.length,
      avg_response_hours:
        repResponseTimes.length > 0
          ? Math.round(
              (repResponseTimes.reduce((a, b) => a + b, 0) /
                repResponseTimes.length) *
                10
            ) / 10
          : null,
    };
  }

  // ============================================
  // SEND PANEL USAGE
  // ============================================

  const assetsSentTotal = sends.length;
  const assetsSentPerLead =
    wLeads.length > 0
      ? Math.round((assetsSentTotal / wLeads.length) * 10) / 10
      : 0;

  // ============================================
  // STALE LEADS
  // ============================================

  const staleLeadCount = leads.filter((l) => l.is_stale).length;
  const activeLeads = leads.filter(
    (l) => !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status as string)
  );
  const staleLeadPct =
    activeLeads.length > 0
      ? Math.round((staleLeadCount / activeLeads.length) * 100)
      : 0;

  // ============================================
  // CONVERSION
  // ============================================

  const dealsWon = wins.length;
  const winRatePct =
    wLeads.length > 0
      ? Math.round((dealsWon / wLeads.length) * 100)
      : null;

  const avgDaysToClose =
    wins.length > 0
      ? Math.round(
          wins.reduce((s, w) => s + ((w.days_to_close as number) || 0), 0) /
            wins.length
        )
      : null;

  // ============================================
  // INTELLIGENCE QUALITY
  // ============================================

  const avgIntentScore =
    intel.length > 0
      ? Math.round(
          intel.reduce((s, i) => s + ((i.intent_score as number) || 0), 0) /
            intel.length
        )
      : null;

  const highIntentLeads = intel.filter(
    (i) => ((i.intent_score as number) || 0) >= 70
  ).length;

  const highIntentLeadIds = new Set(
    intel
      .filter((i) => ((i.intent_score as number) || 0) >= 70)
      .map((i) => i.lead_id as string)
  );

  const highIntentLeadsContacted = wLeads.filter(
    (l) => highIntentLeadIds.has(l.id as string) && l.status !== "NEW"
  ).length;

  const highIntentContactRate =
    highIntentLeads > 0
      ? Math.round((highIntentLeadsContacted / highIntentLeads) * 100)
      : null;

  // ============================================
  // FOLLOW-UP COMPLIANCE
  // ============================================

  const nonTerminalLeads = leads.filter(
    (l) => !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status as string)
  );

  const leadsWithFollowup = nonTerminalLeads.filter(
    (l) => !!l.follow_up_date
  ).length;

  const leadsWithFollowupPct =
    nonTerminalLeads.length > 0
      ? Math.round((leadsWithFollowup / nonTerminalLeads.length) * 100)
      : 0;

  const overdueFollowups = nonTerminalLeads.filter((l) => {
    if (!l.follow_up_date) return false;
    return new Date(l.follow_up_date as string) < now;
  }).length;

  return {
    clientId,
    clientName: client.name as string,
    industry: (client.industry as string) || "service business",
    weekStart,
    weekEnd,
    totalLeads: leads.length,
    newLeads: wLeads.length,
    contactRatePct,
    avgResponseTimeHours,
    sourcePerformance,
    salespersonPerformance,
    assetsSentTotal,
    assetsSentPerLead,
    staleLeadCount,
    staleLeadPct,
    dealsWon,
    winRatePct,
    avgDaysToClose,
    avgIntentScore,
    highIntentLeads,
    highIntentContactRate,
    leadsWithFollowupPct,
    overdueFollowups,
  };
}

// ============================================
// SAVE PERFORMANCE SNAPSHOT
// ============================================

export async function savePerformanceSnapshot(
  data: PerformanceData
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from("performance_snapshots").upsert(
    {
      client_id: data.clientId,
      week_start: data.weekStart.toISOString().split("T")[0],
      week_end: data.weekEnd.toISOString().split("T")[0],
      total_leads: data.totalLeads,
      new_leads: data.newLeads,
      contact_rate_pct: data.contactRatePct,
      avg_response_time_hours: data.avgResponseTimeHours,
      source_performance: data.sourcePerformance,
      salesperson_performance: data.salespersonPerformance,
      assets_sent_total: data.assetsSentTotal,
      assets_sent_per_lead: data.assetsSentPerLead,
      stale_lead_count: data.staleLeadCount,
      stale_lead_pct: data.staleLeadPct,
      deals_won: data.dealsWon,
      win_rate_pct: data.winRatePct,
      avg_days_to_close: data.avgDaysToClose,
      avg_intent_score: data.avgIntentScore,
      high_intent_leads: data.highIntentLeads,
      high_intent_contact_rate: data.highIntentContactRate,
      leads_with_followup_pct: data.leadsWithFollowupPct,
      overdue_followups: data.overdueFollowups,
    },
    {
      onConflict: "client_id,week_start",
    }
  );
}

// ============================================
// DEDUPLICATION KEY
// Prevents the same recommendation being
// generated twice in the same month
// ============================================

function makeDedupKey(
  clientId: string,
  category: string,
  signal: string
): string {
  const monthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  return crypto
    .createHash("md5")
    .update(`${clientId}:${category}:${signal}:${monthStr}`)
    .digest("hex")
    .slice(0, 16);
}

// ============================================
// RECOMMENDATION GENERATION
// ============================================

type Recommendation = {
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  supporting_data: Record<string, unknown>;
  about_salesperson_id?: string;
  about_salesperson_name?: string;
  dedup_key: string;
};

export async function generateRecommendations(
  data: PerformanceData
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // ============================================
  // RULE 1 — RESPONSE TIME
  // If avg response time > 2 hours flag it
  // ============================================

  if (data.avgResponseTimeHours !== null && data.avgResponseTimeHours > 2) {
    const priority: "critical" | "high" | "medium" =
      data.avgResponseTimeHours > 6
        ? "critical"
        : data.avgResponseTimeHours > 3
        ? "high"
        : "medium";

    const dedupKey = makeDedupKey(
      data.clientId,
      "response_time",
      `${Math.round(data.avgResponseTimeHours)}`
    );

    let body = "";
    try {
      body = await callClaude({
        system: `You write short, specific sales performance recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. No bullet points. Be direct and specific.
Name the actual numbers. Tell them exactly what to do.`,
        userMessage: `Write a recommendation about slow response time.
Average response time: ${data.avgResponseTimeHours} hours.
Contact rate this week: ${data.contactRatePct ?? "unknown"}%.
Industry: ${data.industry}.
The recommendation should tell them what the impact is and what to change.`,
        maxTokens: 120,
      });
    } catch {
      body = `Your team is taking an average of ${data.avgResponseTimeHours} hours to make the first call after a lead comes in. Leads go cold fast — most buying decisions happen within the first hour. Set a rule that every new lead gets called within 30 minutes.`;
    }

    recommendations.push({
      category: "response_time",
      priority,
      title: `Average response time is ${data.avgResponseTimeHours}h — leads are going cold`,
      body,
      supporting_data: {
        avg_response_time_hours: data.avgResponseTimeHours,
        contact_rate_pct: data.contactRatePct,
        new_leads_this_week: data.newLeads,
      },
      dedup_key: dedupKey,
    });
  }

  // ============================================
  // RULE 2 — SOURCE PERFORMANCE DISPARITY
  // If one source has significantly lower contact
  // rate than another, flag it
  // ============================================

  const sources = Object.entries(data.sourcePerformance).filter(
    ([, sp]) => sp.count >= 3
  );

  if (sources.length >= 2) {
    const sorted = sources.sort(
      (a, b) => b[1].contact_rate - a[1].contact_rate
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best[1].contact_rate - worst[1].contact_rate >= 25) {
      const dedupKey = makeDedupKey(
        data.clientId,
        "lead_quality",
        `${worst[0]}_vs_${best[0]}`
      );

      const sourceLabels: Record<string, string> = {
        FACEBOOK: "Facebook",
        LANDING_PAGE: "profile page",
        MANUAL: "manual entry",
        REFERRAL: "referral",
      };

      let body = "";
      try {
        body = await callClaude({
          system: `You write short, specific sales performance recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. No bullet points. Be direct. Name the sources and the actual numbers.`,
          userMessage: `Write a recommendation about lead source performance gap.
Best source: ${sourceLabels[best[0]] || best[0]} with ${best[1].contact_rate}% contact rate (${best[1].count} leads).
Worst source: ${sourceLabels[worst[0]] || worst[0]} with ${worst[1].contact_rate}% contact rate (${worst[1].count} leads).
Industry: ${data.industry}.`,
          maxTokens: 120,
        });
      } catch {
        body = `${sourceLabels[best[0]] || best[0]} leads are being contacted at ${best[1].contact_rate}% but ${sourceLabels[worst[0]] || worst[0]} leads at only ${worst[1].contact_rate}%. This is a ${best[1].contact_rate - worst[1].contact_rate} percentage point gap. Review the creative and targeting for the underperforming source or reallocate budget to what is working.`;
      }

      recommendations.push({
        category: "lead_quality",
        priority: "high",
        title: `${sourceLabels[best[0]] || best[0]} leads convert ${best[1].contact_rate - worst[1].contact_rate}% better than ${sourceLabels[worst[0]] || worst[0]}`,
        body,
        supporting_data: {
          best_source: best[0],
          best_contact_rate: best[1].contact_rate,
          best_count: best[1].count,
          worst_source: worst[0],
          worst_contact_rate: worst[1].contact_rate,
          worst_count: worst[1].count,
        },
        dedup_key: dedupKey,
      });
    }
  }

  // ============================================
  // RULE 3 — HIGH INTENT LEADS NOT CONTACTED
  // If high intent leads have lower contact rate
  // than overall contact rate
  // ============================================

  if (
    data.highIntentLeads >= 3 &&
    data.highIntentContactRate !== null &&
    data.contactRatePct !== null &&
    data.highIntentContactRate < data.contactRatePct - 10
  ) {
    const dedupKey = makeDedupKey(
      data.clientId,
      "call_quality",
      `high_intent_${data.highIntentLeads}`
    );

    let body = "";
    try {
      body = await callClaude({
        system: `You write short, specific sales performance recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. Be direct. Name the numbers.`,
        userMessage: `Write a recommendation about high-intent leads not being prioritised.
High intent leads this week: ${data.highIntentLeads}.
High intent contact rate: ${data.highIntentContactRate}%.
Overall contact rate: ${data.contactRatePct}%.
Industry: ${data.industry}.`,
        maxTokens: 120,
      });
    } catch {
      body = `You have ${data.highIntentLeads} high-intent leads this week that were scored above 70 — meaning they showed strong buying signals — but only ${data.highIntentContactRate}% were contacted, versus ${data.contactRatePct}% overall. Sort leads by intent score and call the highest-scored ones first.`;
    }

    recommendations.push({
      category: "call_quality",
      priority: "high",
      title: `${data.highIntentLeads} high-intent leads contacted at only ${data.highIntentContactRate}%`,
      body,
      supporting_data: {
        high_intent_leads: data.highIntentLeads,
        high_intent_contact_rate: data.highIntentContactRate,
        overall_contact_rate: data.contactRatePct,
      },
      dedup_key: dedupKey,
    });
  }

  // ============================================
  // RULE 4 — SEND PANEL UNDERUSED
  // If assets sent per lead is very low
  // ============================================

  if (data.newLeads >= 5 && data.assetsSentPerLead < 0.3) {
    const dedupKey = makeDedupKey(
      data.clientId,
      "send_assets",
      `${data.assetsSentTotal}_sends`
    );

    let body = "";
    try {
      body = await callClaude({
        system: `You write short, specific sales performance recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. Be direct.`,
        userMessage: `Write a recommendation about low send panel usage.
Leads this week: ${data.newLeads}.
Assets sent: ${data.assetsSentTotal}.
Assets per lead: ${data.assetsSentPerLead}.
Industry: ${data.industry}.
The team has the ability to send portfolios, pricing packages, and project links directly to leads via WhatsApp but is not using it.`,
        maxTokens: 120,
      });
    } catch {
      body = `The team sent ${data.assetsSentTotal} assets to ${data.newLeads} leads this week — only ${data.assetsSentPerLead} sends per lead. Prospects who receive the portfolio or a pricing package convert significantly faster. Train the team to send relevant materials immediately after a successful call.`;
    }

    recommendations.push({
      category: "send_assets",
      priority: "medium",
      title: `Team sent assets to only ${Math.round(data.assetsSentPerLead * 100)}% of leads`,
      body,
      supporting_data: {
        assets_sent: data.assetsSentTotal,
        new_leads: data.newLeads,
        assets_per_lead: data.assetsSentPerLead,
      },
      dedup_key: dedupKey,
    });
  }

  // ============================================
  // RULE 5 — STALE LEADS PILING UP
  // If more than 20% of active leads are stale
  // ============================================

  if (data.staleLeadPct >= 20) {
    const priority: "critical" | "high" =
      data.staleLeadPct >= 40 ? "critical" : "high";

    const dedupKey = makeDedupKey(
      data.clientId,
      "follow_up",
      `stale_${data.staleLeadCount}`
    );

    let body = "";
    try {
      body = await callClaude({
        system: `You write short, specific sales performance recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. Be direct. Name the numbers.`,
        userMessage: `Write a recommendation about stale leads.
Stale leads: ${data.staleLeadCount} (${data.staleLeadPct}% of active pipeline).
Industry: ${data.industry}.
A lead is stale when it has had no activity in 7+ days.`,
        maxTokens: 120,
      });
    } catch {
      body = `${data.staleLeadCount} leads — ${data.staleLeadPct}% of the active pipeline — have had no activity in over 7 days. These are not lost yet but they are getting cold. Use the re-engagement message feature to send each stale lead a personalised WhatsApp message today.`;
    }

    recommendations.push({
      category: "follow_up",
      priority,
      title: `${data.staleLeadPct}% of the pipeline is stale — ${data.staleLeadCount} leads need attention`,
      body,
      supporting_data: {
        stale_lead_count: data.staleLeadCount,
        stale_lead_pct: data.staleLeadPct,
        total_active: data.totalLeads,
      },
      dedup_key: dedupKey,
    });
  }

  // ============================================
  // RULE 6 — FOLLOW-UP COMPLIANCE
  // If less than 50% of leads have a follow-up
  // date set
  // ============================================

  if (data.totalLeads >= 5 && data.leadsWithFollowupPct < 50) {
    const dedupKey = makeDedupKey(
      data.clientId,
      "follow_up",
      `followup_compliance_${Math.round(data.leadsWithFollowupPct)}`
    );

    let body = "";
    try {
      body = await callClaude({
        system: `You write short, specific sales performance recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. Be direct.`,
        userMessage: `Write a recommendation about poor follow-up scheduling.
Percentage of leads with a follow-up date set: ${data.leadsWithFollowupPct}%.
Overdue follow-ups: ${data.overdueFollowups}.
Industry: ${data.industry}.`,
        maxTokens: 120,
      });
    } catch {
      body = `Only ${data.leadsWithFollowupPct}% of leads have a follow-up date scheduled. Without a scheduled next step leads go cold by default. Train the team that every call must end with a follow-up date set in the platform — even if the prospect said call back in two weeks.`;
    }

    recommendations.push({
      category: "follow_up",
      priority: "medium",
      title: `Only ${data.leadsWithFollowupPct}% of leads have a follow-up date set`,
      body,
      supporting_data: {
        followup_compliance_pct: data.leadsWithFollowupPct,
        overdue_followups: data.overdueFollowups,
        total_leads: data.totalLeads,
      },
      dedup_key: dedupKey,
    });
  }

  // ============================================
  // RULE 7 — INDIVIDUAL SALESPERSON PERFORMANCE
  // If one salesperson has significantly lower
  // contact rate than the team average
  // Only the worst performer per run
  // ============================================

  const repEntries = Object.entries(data.salespersonPerformance).filter(
    ([, sp]) => sp.assigned >= 3
  );

  if (repEntries.length >= 2) {
    const avgContactRate =
      repEntries.reduce((sum, [, sp]) => {
        const rate = sp.assigned > 0 ? (sp.contacted / sp.assigned) * 100 : 0;
        return sum + rate;
      }, 0) / repEntries.length;

    for (const [repId, rep] of repEntries) {
      const repContactRate =
        rep.assigned > 0
          ? Math.round((rep.contacted / rep.assigned) * 100)
          : 0;

      if (avgContactRate - repContactRate >= 20 && repContactRate < 40) {
        const dedupKey = makeDedupKey(
          data.clientId,
          "salesperson",
          `${repId}_contact_rate`
        );

        let body = "";
        try {
          body = await callClaude({
            system: `You write short, specific sales performance coaching recommendations for a ${data.industry} business in Africa.
One paragraph. Under 60 words. Be constructive and specific. Name the salesperson and the numbers.`,
            userMessage: `Write a recommendation about a salesperson's low contact rate.
Salesperson: ${rep.name}.
Their contact rate: ${repContactRate}%.
Team average: ${Math.round(avgContactRate)}%.
Calls logged: ${rep.calls_logged}.
Leads assigned: ${rep.assigned}.
Industry: ${data.industry}.`,
            maxTokens: 120,
          });
        } catch {
          body = `${rep.name} has contacted ${repContactRate}% of their assigned leads this week against a team average of ${Math.round(avgContactRate)}%. With ${rep.assigned} leads assigned and ${rep.calls_logged} calls logged something is blocking progress — review their call schedule and check if any leads are being skipped.`;
        }

        recommendations.push({
          category: "salesperson",
          priority: "high",
          title: `${rep.name} contact rate is ${repContactRate}% vs team average of ${Math.round(avgContactRate)}%`,
          body,
          supporting_data: {
            salesperson_name: rep.name,
            contact_rate: repContactRate,
            team_avg_contact_rate: Math.round(avgContactRate),
            calls_logged: rep.calls_logged,
            assigned: rep.assigned,
          },
          about_salesperson_id: repId,
          about_salesperson_name: rep.name,
          dedup_key: dedupKey,
        });

        // Only flag the worst performer per run
        break;
      }
    }
  }

  return recommendations;
}

// ============================================
// SAVE RECOMMENDATIONS
// Deduplicates before inserting
// ============================================

export async function saveRecommendations(
  clientId: string,
  recommendations: Recommendation[]
): Promise<void> {
  const supabase = createAdminClient();

  if (recommendations.length === 0) return;

  // Get existing dedup keys for this client to avoid inserting duplicates
  const { data: existing } = await supabase
    .from("client_recommendations")
    .select("dedup_key")
    .eq("client_id", clientId)
    .eq("status", "active")
    .not("dedup_key", "is", null);

  const existingKeys = new Set(
    (existing ?? []).map((r) => r.dedup_key as string)
  );

  const toInsert = recommendations
    .filter((r) => !existingKeys.has(r.dedup_key))
    .map((r) => ({
      client_id: clientId,
      category: r.category,
      priority: r.priority,
      title: r.title,
      body: r.body,
      supporting_data: r.supporting_data,
      about_salesperson_id: r.about_salesperson_id ?? null,
      about_salesperson_name: r.about_salesperson_name ?? null,
      dedup_key: r.dedup_key,
      status: "active",
    }));

  if (toInsert.length === 0) return;

  const { error } = await supabase
    .from("client_recommendations")
    .insert(toInsert);

  if (error) {
    console.error(
      `saveRecommendations: insert failed for client ${clientId}:`,
      error
    );
  }
}

// ============================================
// FULL PIPELINE — COLLECT + ANALYSE + SAVE
// Called from the weekly cron and daily cron
// ============================================

export async function runPerformanceAnalysis(
  clientId: string
): Promise<void> {
  try {
    const data = await collectPerformanceData(clientId);
    if (!data) return;

    await savePerformanceSnapshot(data);

    const recommendations = await generateRecommendations(data);
    await saveRecommendations(clientId, recommendations);

    console.log(
      `runPerformanceAnalysis: ${recommendations.length} recommendations generated for client ${clientId}`
    );
  } catch (err) {
    console.error(
      `runPerformanceAnalysis: failed for client ${clientId}:`,
      err
    );
  }
}

export async function runPerformanceAnalysisAllClients(): Promise<void> {
  const supabase = createAdminClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false);

  for (const client of clients ?? []) {
    await runPerformanceAnalysis(client.id as string);
  }
}
