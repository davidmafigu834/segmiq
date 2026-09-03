import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";
import { wrapUntrustedContent } from "@/lib/company-brain/authority";
import type { RequirementStatus } from "./types";

export type ExtractedRequirement = {
  label: string;
  quantity: number | null;
  status: RequirementStatus;
  raw: string;
};

export type ConversationExtraction = {
  items: ExtractedRequirement[];
  location: string | null;
  textForModel: string;
  inboundCount: number;
};

const UNCERTAIN = /\b(maybe|might|around|later|thinking|possibly|not sure|approximately)\b/i;
const CONFIRMED = /\b(i want|send me|quote (me|for)|need \d+|please quote|we need|order for|add one additional)\b/i;

export function classifyRequirementStatus(sentence: string): RequirementStatus {
  if (UNCERTAIN.test(sentence)) return "UNCERTAIN";
  if (CONFIRMED.test(sentence)) return "CONFIRMED";
  return "MENTIONED";
}

export function extractRequirementsFromText(text: string): ExtractedRequirement[] {
  const items: ExtractedRequirement[] = [];
  const packageHit = text.match(
    /(?:want|need|quote).{0,60}?(\d+(?:\.\d+)?\s*kva(?:\s+[A-Za-z0-9]+){0,4})(?:\s+package)?/i
  );
  if (packageHit?.[1]) {
    items.push({
      label: packageHit[1].replace(/\s+package$/i, "").trim(),
      quantity: 1,
      status: classifyRequirementStatus(text),
      raw: packageHit[0],
    });
  }
  const extra = text.match(/add (?:one )?(?:additional |extra |another )?([A-Za-z0-9][\w\s\-]{3,80}?)(?:\.|$)/i);
  if (extra?.[1]) {
    items.push({
      label: extra[1].trim(),
      quantity: 1,
      status: classifyRequirementStatus(text),
      raw: extra[0],
    });
  }
  const qtyRe = /(\d+)\s*(?:x|×)?\s+([A-Za-z][\w\s\-]{2,60}?)(?=(?:,| and |\.|$))/gi;
  let m: RegExpExecArray | null;
  while ((m = qtyRe.exec(text)) !== null) {
    const label = m[2]!.trim();
    if (/kva/i.test(label)) continue;
    if (items.some((it) => it.label.toLowerCase() === label.toLowerCase())) continue;
    items.push({
      label,
      quantity: Number(m[1]),
      status: classifyRequirementStatus(text),
      raw: m[0],
    });
  }
  return items;
}

export function extractLocation(text: string): string | null {
  const m = text.match(/\b(?:deliver(?:y)?|site|location)\s+(?:to\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/);
  return m?.[1] ?? null;
}

export async function loadConversationExtraction(opts: {
  clientId: string;
  leadId: string;
}): Promise<ConversationExtraction> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("direction, body, text, created_at")
    .eq("lead_id", opts.leadId)
    .eq("client_id", opts.clientId)
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = asRows<{
    direction: string | null;
    body: string | null;
    text: string | null;
    created_at: string;
  }>(data).reverse();

  const inbound = rows.filter((r) => (r.direction ?? "").toLowerCase() === "inbound" || r.direction === "in");
  const combined = inbound
    .map((r) => (r.body || r.text || "").trim())
    .filter(Boolean)
    .join("\n");

  const items = extractRequirementsFromText(combined);
  return {
    items,
    location: extractLocation(combined),
    textForModel: wrapUntrustedContent("CUSTOMER_CONVERSATION", combined.slice(0, 4000)),
    inboundCount: inbound.length,
  };
}
