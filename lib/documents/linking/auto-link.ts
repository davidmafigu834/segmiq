import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { mergeLinkSignals } from "@/lib/documents/linking/extract-signals";
import {
  searchContactCandidates,
  searchDealCandidates,
  searchLeadCandidates,
  searchQuotationCandidates,
} from "@/lib/documents/linking/search";
import { upsertDocumentEntityLinks } from "@/lib/documents/linking/store";
import { DOCUMENT_LINKER_VERSION } from "@/lib/documents/linking/types";
import type { LinkCandidate, LinkConfidence } from "@/lib/documents/linking/types";
import { createAdminClient } from "@/lib/supabase/admin";

function confidenceRank(level: LinkConfidence): number {
  return level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1;
}

function dedupeCandidates(candidates: LinkCandidate[]): LinkCandidate[] {
  const map = new Map<string, LinkCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.entityType}:${candidate.entityId}`;
    const existing = map.get(key);
    if (!existing || confidenceRank(candidate.confidence) > confidenceRank(existing.confidence)) {
      map.set(key, candidate);
    }
  }
  return [...map.values()];
}

function applyContactConfirmationPolicy(
  contacts: LinkCandidate[],
  autoLinkHigh: boolean
): Array<LinkCandidate & { confirmed: boolean }> {
  const ranked = [...contacts].sort(
    (a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence)
  );
  const high = ranked.filter((c) => c.confidence === "HIGH");

  if (high.length === 1 && autoLinkHigh) {
    const winner = high[0]!;
    return ranked
      .filter((c) => confidenceRank(c.confidence) >= 2)
      .map((c) => ({ ...c, confirmed: c.entityId === winner.entityId && c.confidence === "HIGH" }));
  }

  if (high.length > 1) {
    return high.map((c) => ({ ...c, confirmed: false }));
  }

  return ranked
    .filter((c) => confidenceRank(c.confidence) >= 2)
    .slice(0, 3)
    .map((c) => ({ ...c, confirmed: false }));
}

function applyQuotationConfirmationPolicy(
  quotes: LinkCandidate[],
  autoLinkHigh: boolean
): Array<LinkCandidate & { confirmed: boolean }> {
  const high = quotes.filter((q) => q.confidence === "HIGH");
  if (high.length === 1 && autoLinkHigh) {
    return [{ ...high[0]!, confirmed: true }];
  }
  return quotes
    .filter((q) => confidenceRank(q.confidence) >= 2)
    .slice(0, 3)
    .map((q) => ({ ...q, confirmed: false }));
}

export async function autoLinkDocumentRecords(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  title: string;
  filename: string;
  plainText: string;
}): Promise<{ linked: number; suggestions: number; needsReview: boolean }> {
  const settings = await loadDocumentCompanySettings(opts.clientId);
  const signals = await mergeLinkSignals(opts);

  const contactCandidates: LinkCandidate[] = [];
  for (const name of signals.partyNames) {
    contactCandidates.push(...(await searchContactCandidates(opts.clientId, { name })));
  }
  for (const email of signals.emails) {
    contactCandidates.push(...(await searchContactCandidates(opts.clientId, { email })));
  }
  for (const phone of signals.phones) {
    contactCandidates.push(...(await searchContactCandidates(opts.clientId, { phone })));
  }

  const dedupedContacts = dedupeCandidates(contactCandidates);
  const contactLinks = applyContactConfirmationPolicy(
    dedupedContacts,
    settings.auto_link_high_confidence
  );

  const confirmedCustomer = contactLinks.find(
    (c) => c.confirmed && c.entityType === "CUSTOMER"
  );

  const secondaryCandidates: LinkCandidate[] = [];
  if (confirmedCustomer) {
    secondaryCandidates.push(
      ...(await searchLeadCandidates(opts.clientId, confirmedCustomer.entityId)),
      ...(await searchDealCandidates(opts.clientId, {
        contactId: confirmedCustomer.entityId,
        nameHint: opts.title,
      }))
    );
  }

  const quoteCandidates: LinkCandidate[] = [];
  for (const quoteNumber of signals.quoteNumbers) {
    quoteCandidates.push(
      ...(await searchQuotationCandidates(
        opts.clientId,
        quoteNumber,
        confirmedCustomer?.entityId ?? null
      ))
    );
  }

  const quoteLinks = applyQuotationConfirmationPolicy(
    dedupeCandidates(quoteCandidates),
    settings.auto_link_high_confidence
  );

  const dealLinks = dedupeCandidates(secondaryCandidates)
    .filter((c) => c.entityType === "DEAL")
    .slice(0, 2)
    .map((c) => ({ ...c, confirmed: false }));

  const leadLinks = dedupeCandidates(secondaryCandidates)
    .filter((c) => c.entityType === "LEAD")
    .slice(0, 1)
    .map((c) => ({ ...c, confirmed: false }));

  const allLinks = [...contactLinks, ...quoteLinks, ...dealLinks, ...leadLinks];
  const linked = await upsertDocumentEntityLinks({
    clientId: opts.clientId,
    documentId: opts.documentId,
    candidates: allLinks,
  });

  const suggestions = allLinks.filter((l) => !l.confirmed).length;
  const needsReview = suggestions > 0;

  if (allLinks.length) {
    const supabase = createAdminClient();
    await supabase.from("document_activity").insert({
      client_id: opts.clientId,
      document_id: opts.documentId,
      version_id: opts.versionId,
      action: "METADATA_EDITED",
      metadata: {
        kind: "entity_linking",
        linked,
        suggestions,
        linkerVersion: DOCUMENT_LINKER_VERSION,
        confirmed: allLinks.filter((l) => l.confirmed).length,
      },
    });
  }

  return { linked, suggestions, needsReview };
}
