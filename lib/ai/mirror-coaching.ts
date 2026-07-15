import { callClaude, getAnthropicModel } from "@/lib/ai/claude";
import {
  hashAiInput,
  lookupCachedAiResponse,
  setCachedAiResponse,
} from "@/lib/ai/response-cache";

const MIRROR_COACHING_PROMPT_VERSION = 1;
const MIRROR_COACHING_TTL_MS = 27 * 60 * 60 * 1000;

type MirrorNumbers = {
  totalActive: number;
  callNow: number;
  calledToday: number;
  followUpToday: number;
  slipped: number;
  convertLaterCount: number;
  wonThisMonth: number;
};

type MirrorLead = {
  name: string;
  status: string;
  priorityLabel: string;
  score: number | null;
  projectType: string | null;
};

type MirrorCoachingInput = {
  userId: string;
  clientId: string;
  now: Date;
  numbers: MirrorNumbers;
  leads: MirrorLead[];
};

function cleanCoachingLine(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim().slice(0, 220);
}

export async function getDailyMirrorCoachingLine({
  userId,
  clientId,
  now,
  numbers,
  leads,
}: MirrorCoachingInput): Promise<string | null> {
  const dateKey = now.toISOString().slice(0, 10);
  const cacheKey = `sales-mirror-coaching:${userId}:${dateKey}`;
  // Deliberately stable for the whole day: dashboard refreshes and activity
  // changes must not trigger additional Claude calls.
  const inputHash = hashAiInput({
    userId,
    dateKey,
    promptVersion: MIRROR_COACHING_PROMPT_VERSION,
  });

  const cache = await lookupCachedAiResponse<{ line: string }>({
    cacheKey,
    inputHash,
    promptVersion: MIRROR_COACHING_PROMPT_VERSION,
  });
  if (cache.status === "hit") return cache.response.line;
  if (cache.status === "unavailable") return null;

  const leadContext = leads.length
    ? leads
        .slice(0, 5)
        .map(
          (lead, index) =>
            `${index + 1}. ${lead.name}: ${lead.priorityLabel}; status ${lead.status}; `
            + `intent score ${lead.score ?? "not scored"}; project ${lead.projectType ?? "not specified"}`
        )
        .join("\n")
    : "No active priority leads.";

  const context = `
Active leads: ${numbers.totalActive}
Fresh leads to call now: ${numbers.callNow}
Follow-ups due today: ${numbers.followUpToday}
Slipped leads to recover: ${numbers.slipped}
Calls logged today: ${numbers.calledToday}
Convert-later leads: ${numbers.convertLaterCount}
Wins this month: ${numbers.wonThisMonth}

Highest-priority leads:
${leadContext}
  `.trim();

  try {
    const generated = await callClaude({
      system: `You are a practical sales coach for a service-business salesperson.
Write one short daily priority sentence for their dashboard.
Lead with the most valuable action to take next.
Use a lead's name only when it makes the advice more specific.
Keep it under 180 characters. No greeting, heading, bullets, quotation marks, or generic encouragement.`,
      userMessage: `Write today's single most useful sales priority from this data:\n\n${context}`,
      maxTokens: 80,
    });
    const line = cleanCoachingLine(generated);
    if (!line) return null;

    await setCachedAiResponse({
      cacheKey,
      feature: "sales_mirror_coaching",
      clientId,
      inputHash,
      response: { line },
      model: getAnthropicModel(),
      promptVersion: MIRROR_COACHING_PROMPT_VERSION,
      ttlMs: MIRROR_COACHING_TTL_MS,
    });

    return line;
  } catch (error) {
    console.error("[sales-mirror] Claude coaching failed:", error);
    return null;
  }
}
