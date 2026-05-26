import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";

// ============================================
// TYPES
// ============================================

type LeadIntelligenceResult = {
  intent_category: string;
  intent_subcategory: string | null;
  urgency_level: "immediate" | "soon" | "planning" | "exploring" | "unknown";
  budget_confidence: "confirmed" | "indicated" | "unknown";
  budget_estimate_usd: number | null;
  project_specificity: "high" | "medium" | "low" | "unknown";
  is_likely_decision_maker: boolean;
  property_type: string | null;
  location_extracted: string | null;
  tags: string[];
  intent_score: number;
  lead_summary: string;
};

// ============================================
// INTENT SCORE CALCULATION
// Separate from engagement score in lead-scoring.ts
// This scores the quality of intent at submission time
// ============================================

function calculateIntentScore(
  result: Omit<LeadIntelligenceResult, "intent_score" | "lead_summary">
): number {
  let score = 0;

  // Project specificity — max 25 points
  const specificityScores: Record<string, number> = {
    high: 25,
    medium: 15,
    low: 5,
    unknown: 0,
  };
  score += specificityScores[result.project_specificity] ?? 0;

  // Urgency — max 25 points
  const urgencyScores: Record<string, number> = {
    immediate: 25,
    soon: 18,
    planning: 10,
    exploring: 3,
    unknown: 0,
  };
  score += urgencyScores[result.urgency_level] ?? 0;

  // Budget confidence — max 25 points
  const budgetScores: Record<string, number> = {
    confirmed: 25,
    indicated: 12,
    unknown: 0,
  };
  score += budgetScores[result.budget_confidence] ?? 0;

  // Decision maker signal — max 15 points
  if (result.is_likely_decision_maker) score += 15;

  // Intent category exists — max 10 points
  // A clearly classified category means the form answers were specific
  if (result.intent_category && result.intent_category !== "unknown") {
    score += 10;
  }

  return Math.min(100, score);
}

// ============================================
// CORE PROCESSING FUNCTION
// ============================================

export async function processLeadIntelligence(leadId: string): Promise<void> {
  const supabase = createAdminClient();

  // Fetch the lead with form data and client info
  const { data: lead } = await supabase
    .from("leads")
    .select(
      `
      id,
      name,
      phone,
      email,
      source,
      status,
      form_data,
      created_at,
      client_id,
      clients (
        name,
        industry
      )
    `
    )
    .eq("id", leadId)
    .single();

  if (!lead) {
    console.error(`processLeadIntelligence: lead ${leadId} not found`);
    return;
  }

  // Get form fields for context
  const { data: formFields } = await supabase
    .from("form_fields")
    .select("label, maps_to, field_type, options")
    .eq("client_id", lead.client_id as string)
    .order("display_order", { ascending: true });

  const clientName = (lead.clients as { name?: string } | null)?.name ?? "Unknown company";
  const clientIndustry = (lead.clients as { industry?: string } | null)?.industry ?? "service business";

  // Build form answers context for Claude
  const formData = (lead.form_data as Record<string, unknown>) ?? {};
  const fields = formFields ?? [];

  const formAnswers = fields
    .map((field) => {
      const value =
        formData[(field.maps_to as string) ?? ""] ??
        formData[field.label as string] ??
        null;
      if (!value) return null;
      return `${field.label as string}: ${Array.isArray(value) ? (value as unknown[]).join(", ") : String(value)}`;
    })
    .filter(Boolean)
    .join("\n");

  // Also include any form_data keys not mapped to specific fields
  const unmappedAnswers = Object.entries(formData)
    .filter(([key]) => !fields.some((f) => f.maps_to === key))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");

  const allAnswers = [formAnswers, unmappedAnswers].filter(Boolean).join("\n");

  if (!allAnswers.trim()) {
    // No form data to process — create a minimal intelligence record
    await upsertIntelligence(leadId, lead.client_id as string, {
      intent_category: "unknown",
      intent_subcategory: null,
      urgency_level: "unknown",
      budget_confidence: "unknown",
      budget_estimate_usd: null,
      project_specificity: "unknown",
      is_likely_decision_maker: false,
      property_type: null,
      location_extracted: null,
      tags: [],
      intent_score: 0,
      lead_summary: `${lead.name as string} submitted an inquiry to ${clientName}.`,
    });
    return;
  }

  // Build the prompt context
  const context = `
Company: ${clientName}
Industry: ${clientIndustry}
Lead name: ${lead.name as string}
Lead source: ${lead.source as string}

Form answers submitted by the prospect:
${allAnswers}
  `.trim();

  // Call Claude to extract structured intelligence
  try {
    const rawOutput = await callClaude({
      system: `You are an expert sales intelligence analyst for a ${clientIndustry} company in Africa.
You analyse lead form submissions and extract structured intelligence to help sales teams prioritise and close deals.
You respond ONLY with valid JSON. No preamble. No explanation. No markdown code fences.
The JSON must exactly match the schema provided. Do not add extra fields. Do not omit required fields.`,

      userMessage: `Analyse this lead submission and extract structured intelligence.

${context}

Respond with this exact JSON structure:
{
  "intent_category": "string — the main service or project type they want, in snake_case, specific to the ${clientIndustry} industry. Examples: residential_solar, commercial_roofing, bathroom_renovation, electrical_installation, garden_landscaping. Use unknown if unclear.",
  "intent_subcategory": "string or null — more specific classification. Example: battery_backup_focus for solar. Null if not determinable.",
  "urgency_level": "one of: immediate, soon, planning, exploring, unknown",
  "budget_confidence": "one of: confirmed, indicated, unknown",
  "budget_estimate_usd": "number or null — best estimate of budget in USD. Extract from answers. Convert from local currency if mentioned. Null if no signal.",
  "project_specificity": "one of: high, medium, low, unknown — how clearly defined is what they want",
  "is_likely_decision_maker": "boolean — true if language suggests they make the purchase decision",
  "property_type": "one of: residential, commercial, industrial, government, ngo, or null",
  "location_extracted": "string or null — city or area name extracted from their answers. Null if not mentioned.",
  "tags": "array of strings — descriptive tags from this list only: first_time_buyer, replacing_existing, insurance_claim, comparing_quotes, referred_by_friend, has_existing_system, new_build, renovation, urgent_repair, large_project, small_project, budget_conscious, premium_buyer, corporate_client, repeat_customer",
  "lead_summary": "string — exactly 2 sentences. First: who this person is and what they want specifically. Second: the most important signal for the salesperson to know before calling."
}`,
      maxTokens: 600,
    });

    // Parse and validate the JSON response
    const cleaned = rawOutput
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as LeadIntelligenceResult;

    // Calculate intent score from parsed fields
    const intentScore = calculateIntentScore(parsed);

    const intelligence: LeadIntelligenceResult = {
      ...parsed,
      intent_score: intentScore,
      // Clamp budget to reasonable values
      budget_estimate_usd:
        parsed.budget_estimate_usd && parsed.budget_estimate_usd > 0
          ? Math.round(parsed.budget_estimate_usd)
          : null,
      // Ensure tags is always an array
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };

    await upsertIntelligence(leadId, lead.client_id as string, intelligence, {
      rawAiOutput: parsed,
    });
  } catch (err) {
    console.error(
      `processLeadIntelligence: Claude processing failed for lead ${leadId}:`,
      err
    );

    // Insert minimal record so we know processing was attempted
    await upsertIntelligence(leadId, lead.client_id as string, {
      intent_category: "unknown",
      intent_subcategory: null,
      urgency_level: "unknown",
      budget_confidence: "unknown",
      budget_estimate_usd: null,
      project_specificity: "unknown",
      is_likely_decision_maker: false,
      property_type: null,
      location_extracted: null,
      tags: [],
      intent_score: 0,
      lead_summary: `${lead.name as string} submitted an inquiry to ${clientName}.`,
    });
  }
}

// ============================================
// UPSERT HELPER
// ============================================

async function upsertIntelligence(
  leadId: string,
  clientId: string,
  intelligence: LeadIntelligenceResult,
  options?: { rawAiOutput?: unknown }
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("lead_intelligence").upsert(
    {
      lead_id: leadId,
      client_id: clientId,
      intent_category: intelligence.intent_category,
      intent_subcategory: intelligence.intent_subcategory,
      urgency_level: intelligence.urgency_level,
      budget_confidence: intelligence.budget_confidence,
      budget_estimate_usd: intelligence.budget_estimate_usd,
      project_specificity: intelligence.project_specificity,
      is_likely_decision_maker: intelligence.is_likely_decision_maker,
      property_type: intelligence.property_type,
      location_extracted: intelligence.location_extracted,
      tags: intelligence.tags,
      intent_score: intelligence.intent_score,
      lead_summary: intelligence.lead_summary,
      raw_ai_output: options?.rawAiOutput ?? {},
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "lead_id",
    }
  );

  if (error) {
    console.error(`upsertIntelligence: failed for lead ${leadId}:`, error);
  }
}

// ============================================
// BATCH REPROCESSING
// Used by the daily cron to process any leads
// that were not processed yet or need reprocessing
// ============================================

export async function processUnprocessedLeads(clientId?: string): Promise<void> {
  const supabase = createAdminClient();

  // Get all lead IDs that have already been processed
  const { data: processed } = await supabase
    .from("lead_intelligence")
    .select("lead_id");

  const processedIds = (processed ?? []).map((r) => r.lead_id as string);

  // Find leads that have no intelligence record yet
  // Limit to 50 per run to avoid timeout
  let query = supabase
    .from("leads")
    .select("id, client_id")
    .eq("is_archived", false)
    .limit(50);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  if (processedIds.length > 0) {
    query = query.not("id", "in", `(${processedIds.join(",")})`);
  }

  const { data: unprocessed } = await query;

  if (!unprocessed || unprocessed.length === 0) return;

  console.log(
    `processUnprocessedLeads: processing ${unprocessed.length} leads`
  );

  for (const lead of unprocessed) {
    try {
      await processLeadIntelligence(lead.id as string);
    } catch (err) {
      console.error(
        `processUnprocessedLeads: failed for lead ${lead.id as string}:`,
        err
      );
      // Continue with next lead
    }
  }
}

// ============================================
// WEEKLY SNAPSHOT BUILDER
// Builds the client_intelligence_snapshots record
// for the past week — called from weekly digest cron
// ============================================

export async function buildWeeklyIntelligenceSnapshot(
  clientId: string
): Promise<void> {
  const supabase = createAdminClient();

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Get all intelligence records for this client this week
  const { data: records } = await supabase
    .from("lead_intelligence")
    .select("*")
    .eq("client_id", clientId)
    .gte("created_at", weekStart.toISOString())
    .lte("created_at", weekEnd.toISOString());

  const recs = records ?? [];
  if (recs.length === 0) return;

  // Intent distribution
  const intentDist: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.intent_category && r.intent_category !== "unknown") {
      intentDist[r.intent_category as string] =
        (intentDist[r.intent_category as string] ?? 0) + 1;
    }
  });

  // Urgency distribution
  const urgencyDist: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.urgency_level) {
      urgencyDist[r.urgency_level as string] =
        (urgencyDist[r.urgency_level as string] ?? 0) + 1;
    }
  });

  // Budget metrics
  const budgetRecs = recs.filter((r) => r.budget_estimate_usd);
  const avgBudget =
    budgetRecs.length > 0
      ? budgetRecs.reduce(
          (sum, r) => sum + ((r.budget_estimate_usd as number) ?? 0),
          0
        ) / budgetRecs.length
      : null;

  // Quality metrics
  const avgIntentScore =
    recs.length > 0
      ? recs.reduce((sum, r) => sum + ((r.intent_score as number) ?? 0), 0) /
        recs.length
      : 0;

  const highIntentLeads = recs.filter(
    (r) => ((r.intent_score as number) ?? 0) >= 70
  ).length;

  // Top tags
  const tagCounts: Record<string, number> = {};
  recs.forEach((r) => {
    ((r.tags as string[]) ?? []).forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Top location
  const locationCounts: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.location_extracted) {
      locationCounts[r.location_extracted as string] =
        (locationCounts[r.location_extracted as string] ?? 0) + 1;
    }
  });
  const topLocation =
    Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  // Generate weekly insight with Claude
  let weeklyInsight = "";
  try {
    const intentSummary = Object.entries(intentDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat.replace(/_/g, " ")}: ${count}`)
      .join(", ");

    const urgencySummary = Object.entries(urgencyDist)
      .map(([u, count]) => `${u}: ${count}`)
      .join(", ");

    weeklyInsight = await callClaude({
      system: `You are a sales intelligence analyst writing a weekly summary for a service business in Africa.
Write 2-3 sentences only. Be specific. Use the actual numbers.
No bullet points. No headers. Plain sentences.`,
      userMessage: `Write a weekly lead intelligence summary.

Total leads this week: ${recs.length}
High intent leads (score 70+): ${highIntentLeads}
Average intent score: ${Math.round(avgIntentScore)}
Top intent categories: ${intentSummary || "mixed"}
Urgency breakdown: ${urgencySummary || "mixed"}
Average budget estimate: ${avgBudget ? `$${Math.round(avgBudget).toLocaleString()}` : "not captured"}
Top location: ${topLocation ?? "not captured"}
Top tags: ${topTags.join(", ") || "none"}`,
      maxTokens: 200,
    });
  } catch (err) {
    console.error(
      "buildWeeklyIntelligenceSnapshot: insight generation failed:",
      err
    );
    weeklyInsight = `${recs.length} leads processed this week with an average intent score of ${Math.round(avgIntentScore)}.`;
  }

  // Upsert the snapshot
  await supabase.from("client_intelligence_snapshots").upsert(
    {
      client_id: clientId,
      week_start: weekStart.toISOString().split("T")[0],
      week_end: weekEnd.toISOString().split("T")[0],
      total_leads: recs.length,
      processed_leads: recs.length,
      intent_distribution: intentDist,
      urgency_distribution: urgencyDist,
      avg_budget_estimate: avgBudget,
      leads_with_budget: budgetRecs.length,
      avg_intent_score: Math.round(avgIntentScore * 10) / 10,
      high_intent_leads: highIntentLeads,
      top_tags: topTags,
      top_location: topLocation,
      weekly_insight: weeklyInsight,
    },
    {
      onConflict: "client_id,week_start",
    }
  );
}
