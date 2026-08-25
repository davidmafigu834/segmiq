import { recordBrainEvent } from "./audit";
import { makeSource } from "./authority";
import { getCachedBrain, setCachedBrain } from "./cache";
import {
  detectWarrantyConflict,
  matchPlaybooks,
  matchServiceArea,
  rankChunks,
  rankFaqs,
  selectContextBundles,
} from "./matching";
import { loadCompanyBrainSnapshot, searchApprovedChunks } from "./store";
import type {
  CompanyBrainContext,
  CompanyBrainSnapshot,
  KnowledgeChunk,
} from "./types";

export type AssembleBrainOpts = {
  clientId: string;
  customerMessage: string;
  conversationType?: string | null;
  productInterest?: string | null;
  canonicalWarranties?: Array<{ productName: string; warranty: string }>;
};

async function snapshotFor(clientId: string): Promise<CompanyBrainSnapshot> {
  const cached = getCachedBrain(clientId);
  if (cached) return cached;
  const snapshot = await loadCompanyBrainSnapshot(clientId);
  setCachedBrain(clientId, snapshot);
  return snapshot;
}

/**
 * CompanyBrainContextService — selects only the operating context needed for
 * this turn. Never loads the entire knowledge library into the prompt.
 */
export async function assembleCompanyBrainContext(
  opts: AssembleBrainOpts
): Promise<{ snapshot: CompanyBrainSnapshot; context: CompanyBrainContext }> {
  let snapshot: CompanyBrainSnapshot;
  try {
    snapshot = await snapshotFor(opts.clientId);
  } catch (err) {
    console.error("[company-brain] snapshot failed", err);
    const empty = emptySnapshot(opts.clientId);
    return {
      snapshot: empty,
      context: {
        ...emptyContext(),
        retrievalFailed: true,
        why: ["Company Brain could not be loaded."],
      },
    };
  }

  const { bundles, topics } = selectContextBundles(opts.customerMessage);
  const why: string[] = [];
  if (topics.length) why.push(`Detected topics: ${topics.join(", ")}.`);
  else why.push("No specific topic detected — loaded identity, voice, sales and qualification.");

  const playbookMatch = matchPlaybooks(opts.customerMessage, snapshot.playbooks, {
    productInterest: opts.productInterest,
    conversationType: opts.conversationType,
  });
  if (playbookMatch.matched) {
    why.push(`Qualification playbook: ${playbookMatch.matched.name}.`);
    if (!bundles.includes("QUALIFICATION")) bundles.push("QUALIFICATION");
  } else if (playbookMatch.ambiguous) {
    why.push("Multiple qualification playbooks could apply — Agent should ask a clarifying question.");
    if (!bundles.includes("QUALIFICATION")) bundles.push("QUALIFICATION");
  }

  const areaMatch = topics.includes("service_area")
    ? matchServiceArea(opts.customerMessage, snapshot.serviceAreas)
    : matchServiceArea(opts.customerMessage, snapshot.serviceAreas);
  if (areaMatch) {
    why.push(
      `Service area ${[areaMatch.area.city, areaMatch.area.region, areaMatch.area.country].filter(Boolean).join(", ") || areaMatch.area.label} = ${areaMatch.area.status}.`
    );
  }

  const faqHits = rankFaqs(opts.customerMessage, snapshot.faqs, 3);
  if (faqHits.length) why.push(`Approved FAQ: ${faqHits[0].faq.question}.`);

  let knowledgeChunks: KnowledgeChunk[] = [];
  const needsDocs =
    topics.includes("warranty") ||
    topics.includes("product") ||
    topics.includes("support") ||
    topics.includes("pricing") ||
    faqHits.length === 0 && topics.length > 0;
  if (needsDocs) {
    try {
      const searched = await searchApprovedChunks(opts.clientId, opts.customerMessage, 8);
      knowledgeChunks = rankChunks(opts.customerMessage, searched, 3);
      if (knowledgeChunks.length) {
        why.push(
          `Knowledge: ${knowledgeChunks
            .map((k) => k.documentTitle || "document")
            .join(", ")}.`
        );
      }
    } catch (err) {
      console.error("[company-brain] document retrieval failed", err);
      // Structured rules still apply; document retrieval must not crash WhatsApp.
    }
  }

  const conflicts: CompanyBrainContext["conflicts"] = [];
  if (opts.canonicalWarranties?.length && knowledgeChunks.length) {
    for (const product of opts.canonicalWarranties) {
      for (const chunk of knowledgeChunks) {
        const clash = detectWarrantyConflict({
          canonicalWarranty: product.warranty,
          documentText: chunk.content,
        });
        if (clash) {
          conflicts.push({
            topic: `Warranty · ${product.productName}`,
            canonical: clash.canonical,
            document: clash.document,
            sourceLabel: chunk.documentTitle || "Approved document",
          });
        }
      }
    }
  }
  if (conflicts.length) {
    why.push("Knowledge conflict detected — canonical product data wins.");
    void recordBrainEvent({
      clientId: opts.clientId,
      eventType: "KNOWLEDGE_CONFLICT",
      summary: conflicts.map((c) => `${c.topic}: ${c.canonical} vs ${c.document}`).join("; "),
      payload: { conflicts },
    });
  }

  const sources = [
    makeSource("company_brain", "identity", "Company Brain → Business Profile"),
    ...(areaMatch
      ? [makeSource("company_rule", "service_area", "Company Brain → Service Areas", areaMatch.area.status)]
      : []),
    ...faqHits.map((row) => makeSource("approved_faq", row.faq.id, `FAQ → ${row.faq.question}`)),
    ...knowledgeChunks.map((chunk) =>
      makeSource(
        "approved_document",
        chunk.id,
        `Knowledge → ${chunk.documentTitle || "Document"}${chunk.pageRef ? ` · ${chunk.pageRef}` : ""}`
      )
    ),
    ...(playbookMatch.matched
      ? [makeSource("company_brain", playbookMatch.matched.id, `Playbook → ${playbookMatch.matched.name}`)]
      : []),
  ];

  const facts = [
    ...faqHits.map((row) => ({
      source: makeSource("approved_faq", row.faq.id, row.faq.question),
      text: row.faq.approvedAnswer,
    })),
    ...knowledgeChunks.map((chunk) => ({
      source: makeSource("approved_document", chunk.id, chunk.documentTitle || "Document"),
      text: chunk.content,
    })),
  ];

  return {
    snapshot,
    context: {
      bundles,
      facts,
      sources,
      playbook: playbookMatch.matched,
      playbookAmbiguous: playbookMatch.ambiguous,
      playbookCandidates: playbookMatch.candidates.map((p) => p.name),
      serviceAreaMatch: areaMatch,
      serviceAreasUnconfigured: snapshot.serviceAreas.filter((a) => a.active).length === 0,
      faqs: faqHits,
      knowledgeChunks,
      conflicts,
      retrievalFailed: false,
      why,
    },
  };
}

function emptyContext(): CompanyBrainContext {
  return {
    bundles: ["COMPANY_IDENTITY", "BRAND_VOICE"],
    facts: [],
    sources: [],
    playbook: null,
    playbookAmbiguous: false,
    playbookCandidates: [],
    serviceAreaMatch: null,
    serviceAreasUnconfigured: true,
    faqs: [],
    knowledgeChunks: [],
    conflicts: [],
    retrievalFailed: false,
    why: [],
  };
}

function emptySnapshot(clientId: string): CompanyBrainSnapshot {
  return {
    settings: {
      clientId,
      tradingName: null,
      businessKind: null,
      customerModel: null,
      agentBusinessExplanation: null,
      languages: ["English"],
      primaryOffering: null,
      catalogueCustomerType: null,
      typicalOrderType: null,
      weDoNotNormallySell: null,
      specialSellingConditions: null,
      pricingGuidance: null,
      neverEstimatePrices: true,
      creditOffered: false,
      paymentPlansOffered: false,
      nonstandardTermsRequireApproval: true,
      paymentGuidance: null,
      supportOffered: false,
      supportHoursNote: null,
      supportDestinationType: null,
      supportDestinationId: null,
      supportCategories: [],
      supportIntakeFields: [],
      autonomousTroubleshooting: false,
      warrantyBoundaries: null,
      voicePrimary: "professional",
      voiceSecondary: null,
      responseLength: "short",
      emojiPolicy: "none",
      greetingStyle: null,
      preferredTerms: [],
      claimsToAvoid: [],
      quoteFollowUpBusinessDays: 2,
      secondFollowUpBusinessDays: 5,
      maxAutonomousFollowUps: 2,
      defaultEscalationMessage: null,
      createdAt: null,
      updatedAt: null,
    },
    exists: false,
    idealCustomers: [],
    playbooks: [],
    stageGuidance: [],
    serviceAreas: [],
    appointmentTypes: [],
    faqs: [],
    examples: [],
    rules: [],
    escalationRules: [],
    knowledgeDocuments: [],
    canonical: {
      companyName: "Company",
      industry: null,
      timezone: "Africa/Harare",
      website: null,
      phone: null,
      email: null,
      address: null,
      country: null,
      productCount: 0,
      serviceCount: 0,
      packageCount: 0,
      quoteTemplateCount: 0,
      currency: "USD",
      paymentTerms: null,
      allowQuotationDiscount: null,
      priceEditPolicy: null,
      hasOperatingHoursRow: false,
      workingDays: [1, 2, 3, 4, 5],
      workStartTime: "08:00",
      workEndTime: "17:00",
      hasQualificationFlow: false,
      teamUserCount: 0,
      agentAutonomyMode: null,
      quoteAutoSendLimit: null,
    },
  };
}

export { snapshotFor as loadCachedCompanyBrainSnapshot };
