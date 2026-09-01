import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractEmails,
  extractPhoneCandidates,
  extractQuoteNumbers,
} from "@/lib/documents/linking/signals";
import type { ExtractedLinkSignals } from "@/lib/documents/linking/types";

export function extractLinkSignalsFromText(text: string, title: string, filename: string): ExtractedLinkSignals {
  const combined = `${title}\n${filename}\n${text}`;
  const partyNames = new Set<string>();

  for (const line of combined.split("\n").slice(0, 120)) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 120) continue;
    if (/^(between|party|customer|client|supplier|vendor)\b/i.test(trimmed)) {
      const cleaned = trimmed
        .replace(/^(between|the parties|party|customer|client|supplier|vendor)[:\s-]+/i, "")
        .replace(/\band\b.*/i, "")
        .trim();
      if (cleaned.length >= 3 && cleaned.length <= 80) partyNames.add(cleaned);
    }
  }

  const titleTokens = title
    .replace(/[_-]+/g, " ")
    .replace(/\.(pdf|docx?|xlsx?|txt)$/i, "")
    .trim();
  if (titleTokens.length >= 3 && titleTokens.length <= 80) {
    partyNames.add(titleTokens);
  }

  return {
    partyNames: [...partyNames].slice(0, 6),
    emails: extractEmails(combined).slice(0, 5),
    phones: extractPhoneCandidates(combined).slice(0, 5),
    quoteNumbers: extractQuoteNumbers(combined).slice(0, 5),
  };
}

export async function extractLinkSignalsFromFacts(
  clientId: string,
  documentId: string,
  versionId: string
): Promise<ExtractedLinkSignals> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_facts")
    .select("fact_type, label, value_json")
    .eq("client_id", clientId)
    .eq("document_id", documentId)
    .eq("version_id", versionId)
    .neq("status", "REJECTED")
    .in("fact_type", ["PARTY", "SIGNATORY", "DOCUMENT_REFERENCE", "PO_NUMBER"]);

  const partyNames: string[] = [];
  const quoteNumbers: string[] = [];

  for (const row of data ?? []) {
    const value = row.value_json;
    const text =
      typeof value === "string"
        ? value
        : value && typeof value === "object" && "text" in (value as Record<string, unknown>)
          ? String((value as { text: string }).text)
          : JSON.stringify(value);

    if (row.fact_type === "PARTY" || row.fact_type === "SIGNATORY") {
      partyNames.push(text);
    }
    if (row.fact_type === "DOCUMENT_REFERENCE" || row.fact_type === "PO_NUMBER") {
      quoteNumbers.push(...extractQuoteNumbers(text));
      if (row.label) quoteNumbers.push(...extractQuoteNumbers(row.label));
    }
  }

  return {
    partyNames: [...new Set(partyNames)].slice(0, 8),
    emails: [],
    phones: [],
    quoteNumbers: [...new Set(quoteNumbers)].slice(0, 5),
  };
}

export async function mergeLinkSignals(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  plainText: string;
  title: string;
  filename: string;
}): Promise<ExtractedLinkSignals> {
  const fromText = extractLinkSignalsFromText(opts.plainText, opts.title, opts.filename);
  const fromFacts = await extractLinkSignalsFromFacts(
    opts.clientId,
    opts.documentId,
    opts.versionId
  );

  return {
    partyNames: [...new Set([...fromText.partyNames, ...fromFacts.partyNames])].slice(0, 8),
    emails: [...new Set([...fromText.emails, ...fromFacts.emails])].slice(0, 5),
    phones: [...new Set([...fromText.phones, ...fromFacts.phones])].slice(0, 5),
    quoteNumbers: [...new Set([...fromText.quoteNumbers, ...fromFacts.quoteNumbers])].slice(0, 5),
  };
}
