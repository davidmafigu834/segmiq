import { callClaude } from "@/lib/ai/claude";
import type { ProposalSectionInput, ProposalSectionKind } from "@/types";

export type ProposalDraftContext = {
  companyName?: string | null;
  recipientName?: string | null;
  industry?: string | null;
  teamSize?: string | null;
  leadVolume?: string | null;
  market?: string | null;
  message?: string | null;
  proposedPlan?: string | null;
  proposalTitle?: string | null;
};

const VALID_KINDS: ProposalSectionKind[] = [
  "cover",
  "scope",
  "approach",
  "timeline",
  "terms",
  "investment",
  "custom",
];

/**
 * Draft the narrative sections of a Segmiq sales proposal from what we know
 * about the prospect (usually a marketing submission). Returns editable
 * sections — the agency admin reviews and edits before sending.
 */
export async function draftProposalSections(
  ctx: ProposalDraftContext
): Promise<ProposalSectionInput[]> {
  const facts = [
    ctx.companyName ? `Company: ${ctx.companyName}` : null,
    ctx.recipientName ? `Contact: ${ctx.recipientName}` : null,
    ctx.industry ? `Industry: ${ctx.industry}` : null,
    ctx.market ? `Market/region: ${ctx.market}` : null,
    ctx.teamSize ? `Team size: ${ctx.teamSize}` : null,
    ctx.leadVolume ? `Lead volume: ${ctx.leadVolume}` : null,
    ctx.proposedPlan ? `Proposed Segmiq plan: ${ctx.proposedPlan}` : null,
    ctx.message ? `What they told us: ${ctx.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You are a B2B sales proposal writer for Segmiq, a CRM and lead-management platform for service businesses (solar, roofing, construction, electrical, landscaping). You write concise, confident, benefit-led proposal copy. Avoid hype and filler. Write in clear British English. You output ONLY valid JSON, no markdown fences, no commentary.`;

  const userMessage = `Write a sales proposal for this prospect:\n${facts || "(limited information — write a strong general Segmiq proposal)"}\n\nReturn a JSON array of 4 sections in this exact shape:\n[{"kind":"cover","heading":"...","body":"..."},{"kind":"scope","heading":"...","body":"..."},{"kind":"approach","heading":"...","body":"..."},{"kind":"timeline","heading":"...","body":"..."}]\n\nRules:\n- kind must be one of: cover, scope, approach, timeline.\n- "cover" = a short opening that names the prospect and the outcome Segmiq delivers (2-3 sentences).\n- "scope" = what is included (4-6 sentences or a short prose list).\n- "approach" = how Segmiq is rolled out for them (3-5 sentences).\n- "timeline" = realistic phased timeline to go live (3-4 sentences).\n- Keep each body under 120 words. Do not invent specific prices.`;

  const raw = await callClaude({ system, userMessage, maxTokens: 1200 });
  return parseSections(raw);
}

function parseSections(raw: string): ProposalSectionInput[] {
  let text = raw.trim();
  // Strip accidental code fences.
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{
      kind?: string;
      heading?: string;
      body?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => (s.body ?? "").trim().length > 0 || (s.heading ?? "").trim().length > 0)
      .map((s) => ({
        kind: (VALID_KINDS.includes(s.kind as ProposalSectionKind)
          ? (s.kind as ProposalSectionKind)
          : "custom") as ProposalSectionKind,
        heading: s.heading?.trim() || null,
        body: s.body?.trim() || null,
      }));
  } catch {
    return [];
  }
}
