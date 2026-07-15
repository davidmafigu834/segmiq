import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadLead } from "@/lib/auth/permissions";
import { callClaude, getAnthropicModel } from "@/lib/ai/claude";
import {
  hashAiInput,
  lookupCachedAiResponse,
  setCachedAiResponse,
} from "@/lib/ai/response-cache";

export const dynamic = "force-dynamic";

const BRIEFING_PROMPT_VERSION = 1;
const BRIEFING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type BriefingResponse = {
  briefing: string;
  suggestion: string;
};

const STATUS_MAP: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Not qualified",
};

export async function GET(
  req: Request,
  { params }: { params: { leadId: string } }
) {
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, phone, email, source, status, form_data, follow_up_date, created_at, client_id, assigned_to_id, deal_value")
    .eq("id", params.leadId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const [{ data: callLogs }, { data: events }] = await Promise.all([
    supabase
      .from("call_logs")
      .select("outcome, notes, created_at")
      .eq("lead_id", params.leadId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("lead_events")
      .select("event_type, event_data, actor_name, created_at")
      .eq("lead_id", params.leadId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const daysActive = Math.round(
    (Date.now() - new Date(lead.created_at as string).getTime()) / (1000 * 60 * 60 * 24)
  );

  const callSummary =
    callLogs && callLogs.length > 0
      ? callLogs
          .map(
            (c) =>
              `- ${c.outcome as string}${c.notes ? `: "${c.notes as string}"` : ""} (${new Date(c.created_at as string).toLocaleDateString()})`
          )
          .join("\n")
      : "No calls logged yet";

  const eventSummary =
    events && events.length > 0
      ? events
          .slice(0, 10)
          .map(
            (e) =>
              `- ${e.event_type as string} by ${(e.actor_name as string | null) ?? "system"}: ${JSON.stringify(e.event_data)}`
          )
          .join("\n")
      : "No events recorded";

  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const formDataSummary =
    Object.keys(formData).length > 0
      ? Object.entries(formData)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(", ")
      : "No form data";

  const context = `
Lead name: ${lead.name as string}
Phone: ${(lead.phone as string | null) ?? "none"}
Status: ${STATUS_MAP[lead.status as string] ?? (lead.status as string)}
Source: ${lead.source as string}
Days active: ${daysActive} days
Deal value: ${lead.deal_value ? `$${lead.deal_value as number}` : "not set"}
Follow-up date: ${(lead.follow_up_date as string | null) ?? "none scheduled"}

Form data (what the prospect told us):
${formDataSummary}

Call history (most recent first):
${callSummary}

Recent events:
${eventSummary}
  `.trim();

  const cacheKey = `lead-briefing:${params.leadId}`;
  const inputHash = hashAiInput({
    context,
    promptVersion: BRIEFING_PROMPT_VERSION,
  });
  const cache = await lookupCachedAiResponse<BriefingResponse>({
    cacheKey,
    inputHash,
    promptVersion: BRIEFING_PROMPT_VERSION,
  });

  if (cache.status === "hit") {
    return NextResponse.json({ ...cache.response, cached: true });
  }
  if (cache.status === "unavailable") {
    return NextResponse.json(
      { error: "AI cache unavailable" },
      { status: 503 }
    );
  }

  try {
    const [briefing, suggestion] = await Promise.all([
      callClaude({
        system: `You are a sales assistant for a service business.
You write concise, factual lead briefings for salespeople.
Write exactly 3 sentences.
First sentence: who the lead is and what they need.
Second sentence: what has been done so far in the sales process.
Third sentence: where things stand right now.
Be specific. Use the actual data provided. Do not use filler phrases like "it is important to note" or "it seems". Be direct.
Do not include any formatting, bullet points, or headers. Plain sentences only.`,
        userMessage: `Write a 3-sentence briefing for this lead:\n\n${context}`,
        maxTokens: 200,
      }),
      callClaude({
        system: `You are a sales coach for a service business.
You give one specific, actionable next step based on lead data.
Write one sentence only.
Be direct and specific. No preamble. No explanation. Just the action.
Examples of good suggestions:
- "Call today and ask about their timeline — they mentioned wanting installation before December."
- "Send the Standard Solar Package — they have a $8,000 budget and asked about pricing."
- "Follow up on the quote you sent 3 days ago — no response yet."`,
        userMessage: `What is the single best next action for this lead?\n\n${context}`,
        maxTokens: 100,
      }),
    ]);

    const response = { briefing, suggestion };
    await setCachedAiResponse({
      cacheKey,
      feature: "lead_briefing",
      clientId: lead.client_id as string,
      leadId: params.leadId,
      inputHash,
      response,
      model: getAnthropicModel(),
      promptVersion: BRIEFING_PROMPT_VERSION,
      ttlMs: BRIEFING_CACHE_TTL_MS,
    });

    return NextResponse.json({ ...response, cached: false });
  } catch (err) {
    console.error("[briefing] Claude call failed:", err);
    return NextResponse.json({ error: "AI briefing unavailable" }, { status: 503 });
  }
}
