import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailsMatch,
  namesLikelyMatch,
  normalizeQuoteNumber,
  phonesLikelyMatch,
  quoteNumbersEquivalent,
} from "@/lib/documents/linking/signals";
import type { LinkCandidate, LinkConfidence } from "@/lib/documents/linking/types";

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  lifecycle: string;
};

function scoreContactMatch(
  contact: ContactRow,
  opts: { name?: string; email?: string; phone?: string }
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  if (opts.email && contact.email && emailsMatch(opts.email, contact.email)) {
    score = Math.max(score, 0.98);
    reasons.push("email match");
  }

  if (opts.phone && contact.phone && phonesLikelyMatch(opts.phone, contact.phone)) {
    score = Math.max(score, 0.95);
    reasons.push("phone match");
  }

  if (opts.name && contact.name) {
    const nameScore = namesLikelyMatch(opts.name, contact.name);
    if (nameScore >= 0.82) {
      score = Math.max(score, nameScore);
      reasons.push("name match");
    } else if (nameScore >= 0.5) {
      score = Math.max(score, nameScore * 0.9);
      reasons.push("similar name");
    }
  }

  return { score, reason: reasons.join(", ") || "textual mention" };
}

function scoreToConfidence(score: number): LinkConfidence {
  if (score >= 0.9) return "HIGH";
  if (score >= 0.65) return "MEDIUM";
  return "LOW";
}

export async function searchContactCandidates(
  clientId: string,
  opts: { name?: string; email?: string; phone?: string }
): Promise<LinkCandidate[]> {
  if (!opts.name && !opts.email && !opts.phone) return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("contacts")
    .select("id, name, email, phone, location, lifecycle")
    .eq("client_id", clientId)
    .limit(25);

  if (opts.name?.trim()) {
    query = query.ilike("name", `%${opts.name.trim()}%`);
  } else if (opts.email?.trim()) {
    query = query.ilike("email", `%${opts.email.trim()}%`);
  } else if (opts.phone?.trim()) {
    const digits = opts.phone.replace(/\D/g, "");
    if (digits.length >= 7) query = query.ilike("phone", `%${digits.slice(-9)}%`);
  }

  const { data } = await query;
  const contacts = (data as ContactRow[]) ?? [];

  return contacts
    .map((contact) => {
      const { score, reason } = scoreContactMatch(contact, opts);
      return {
        entityType: "CUSTOMER" as const,
        entityId: contact.id,
        linkType: contact.lifecycle === "customer" ? ("PRIMARY_CUSTOMER" as const) : ("RELATED_CUSTOMER" as const),
        confidence: scoreToConfidence(score),
        matchReason: reason,
        label: contact.name ?? "Unnamed contact",
        subtitle: [contact.location, contact.email, contact.phone].filter(Boolean).join(" · ") || null,
        metadata: { lifecycle: contact.lifecycle, score },
      };
    })
    .filter((row) => (row.metadata?.score as number) >= 0.45)
    .sort((a, b) => Number(b.metadata?.score ?? 0) - Number(a.metadata?.score ?? 0))
    .slice(0, 5);
}

export async function searchQuotationCandidates(
  clientId: string,
  quoteNumber: string,
  contactId?: string | null
): Promise<LinkCandidate[]> {
  const supabase = createAdminClient();
  const normalized = normalizeQuoteNumber(quoteNumber);
  const digits = normalized.replace(/\D/g, "");

  let query = supabase
    .from("quotations")
    .select("id, quote_number, customer_name, status, lead_id, deal_id")
    .eq("client_id", clientId)
    .not("quote_number", "is", null)
    .limit(10);

  if (digits) {
    query = query.or(`quote_number.ilike.%${digits}%,quote_number.ilike.%${normalized}%`);
  }

  const { data } = await query;
  const rows = data ?? [];

  const candidates: LinkCandidate[] = [];
  for (const row of rows) {
    const quoteNo = row.quote_number as string;
    const exact = quoteNumbersEquivalent(quoteNo, quoteNumber);
    let confidence: LinkConfidence = exact ? "HIGH" : "MEDIUM";

    if (contactId && row.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("contact_id")
        .eq("id", row.lead_id as string)
        .maybeSingle();
      if (lead?.contact_id && lead.contact_id !== contactId) {
        confidence = "LOW";
      }
    }

    candidates.push({
      entityType: "QUOTATION",
      entityId: row.id as string,
      linkType: "SOURCE_QUOTATION",
      confidence,
      matchReason: exact ? "quote number match" : "similar quote number",
      label: quoteNo,
      subtitle: [row.customer_name, row.status].filter(Boolean).join(" · ") || null,
      metadata: { quoteNumber: quoteNo },
    });
  }

  return candidates.sort((a, b) => {
    const rank = (c: LinkConfidence) => (c === "HIGH" ? 3 : c === "MEDIUM" ? 2 : 1);
    return rank(b.confidence) - rank(a.confidence);
  });
}

export async function searchDealCandidates(
  clientId: string,
  opts: { contactId: string; nameHint?: string }
): Promise<LinkCandidate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deals")
    .select("id, name, stage, location, contact_id")
    .eq("client_id", clientId)
    .eq("contact_id", opts.contactId)
    .order("updated_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((deal) => {
    const nameScore = opts.nameHint ? namesLikelyMatch(opts.nameHint, deal.name as string) : 0;
    const confidence: LinkConfidence =
      nameScore >= 0.7 ? "HIGH" : nameScore >= 0.45 ? "MEDIUM" : "LOW";
    return {
      entityType: "DEAL" as const,
      entityId: deal.id as string,
      linkType: "SOURCE_DEAL" as const,
      confidence,
      matchReason: nameScore > 0 ? "deal name similarity" : "customer deal history",
      label: deal.name as string,
      subtitle: [deal.stage, deal.location].filter(Boolean).join(" · ") || null,
      metadata: { stage: deal.stage, score: nameScore },
    };
  });
}

export async function searchLeadCandidates(
  clientId: string,
  contactId: string
): Promise<LinkCandidate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, status, project_type, contact_id")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (data ?? []).map((lead) => ({
    entityType: "LEAD" as const,
    entityId: lead.id as string,
    linkType: "SOURCE_LEAD" as const,
    confidence: "MEDIUM" as const,
    matchReason: "linked customer lead",
    label: (lead.name as string) ?? "Lead",
    subtitle: [lead.status, lead.project_type].filter(Boolean).join(" · ") || null,
  }));
}
