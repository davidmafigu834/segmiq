/**
 * Derived solar sales stage.
 *
 * Source of truth, in order:
 * 1. Deal Won / Lost (closeDealWon / closeDealLost).
 * 2. A successfully sent quotation (status sent/viewed/accepted/rejected/expired, or sent_at).
 * 3. A real pre-send quotation (draft, pending approval, or approved, not sent).
 * 4. A completed sales site visit with a completed assessment.
 * 5. A manual SITE_VISIT_REQUIRED intent, an open sales visit, or a legacy SCOPING deal.
 * 6. Lead lifecycle: QUALIFIED, CONTACTED, NEW.
 *
 * Passing the scheduled date does not complete a visit.
 * A missing quotation cannot display Proposal Prepared or Quote Sent.
 * General Trades does not use this stage list.
 *
 * Legacy solar mapping (display only — rows are not rewritten):
 * - lead NEW / CONTACTED / QUALIFIED stay on those stages when no later fact exists
 * - deal QUALIFIED with no visit and no quote stays Qualified
 * - deal SCOPING with no completed visit and no quote displays Site Visit Required
 * - deal SCOPING with a completed assessment and no quote displays Site Visit Completed
 * - a draft/pending/approved quote displays Proposal Prepared
 * - a sent quote displays Quote Sent, unless the deal is Negotiating
 * - deal WON / LOST stay Won / Lost
 * Completion is never invented from a date or from SCOPING alone.
 */

import type { SolarQuoteFact, SolarSalesFacts, SolarSalesStage, SolarVisitFact } from "./types";

const PRE_SEND = new Set(["draft", "pending_approval", "approved"]);
const SENT = new Set(["sent", "viewed", "accepted", "rejected", "expired"]);
const OPEN_VISIT = new Set(["SCHEDULED", "ON_SITE", "RESCHEDULED"]);

export type QuoteLayer = "NONE" | "PREPARED" | "SENT";

export function activeQuotes(quotes: SolarQuoteFact[]): SolarQuoteFact[] {
  return quotes.filter((quote) => quote.status !== "superseded");
}

export function quoteLayer(quotes: SolarQuoteFact[]): QuoteLayer {
  const rows = activeQuotes(quotes);
  if (rows.some((quote) => Boolean(quote.sentAt) || SENT.has(quote.status))) return "SENT";
  if (rows.some((quote) => PRE_SEND.has(quote.status) && !quote.sentAt)) return "PREPARED";
  return "NONE";
}

export function visitCompleted(visits: SolarVisitFact[]): boolean {
  return visits.some((visit) => visit.status === "COMPLETED" && visit.assessmentStatus === "COMPLETED");
}

export function visitOpen(visits: SolarVisitFact[]): boolean {
  return visits.some((visit) => OPEN_VISIT.has(visit.status));
}

export function quoteAccepted(quotes: SolarQuoteFact[]): boolean {
  return activeQuotes(quotes).some((quote) => quote.status === "accepted");
}

export function getSolarSalesStage(facts: SolarSalesFacts): SolarSalesStage | null {
  if (facts.preset !== "SOLAR_INSTALLATION") return null;
  if (facts.leadStatus === "NOT_QUALIFIED") return null;

  const quotes = quoteLayer(facts.quotes);
  const completed = visitCompleted(facts.visits);
  const open = visitOpen(facts.visits);
  const intent = facts.salesCommercialIntent;
  const deal = facts.dealStage;

  if (deal === "WON") return "WON";
  if (deal === "LOST") return "LOST";

  const negotiating = deal === "NEGOTIATING" || intent === "NEGOTIATING";
  if (quotes === "SENT" && negotiating) return "NEGOTIATION";
  if (quotes === "SENT") return "QUOTE_SENT";
  if (quotes === "PREPARED") return "PROPOSAL_PREPARED";
  if (completed) return "SITE_VISIT_COMPLETED";

  const legacyScoping = deal === "SCOPING";
  if (intent === "SITE_VISIT_REQUIRED" || open || legacyScoping) return "SITE_VISIT_REQUIRED";

  if (
    facts.leadStatus === "QUALIFIED" ||
    facts.leadStatus === "CONVERTED_TO_DEAL" ||
    (deal != null && deal !== "WON" && deal !== "LOST")
  ) {
    return "QUALIFIED";
  }
  if (facts.leadStatus === "CONTACTED") return "CONTACTED";
  if (facts.leadStatus === "NEW" || facts.leadStatus == null) return "NEW_LEAD";
  return "NEW_LEAD";
}

const FUNNEL: SolarSalesStage[] = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT_REQUIRED",
  "SITE_VISIT_COMPLETED",
  "PROPOSAL_PREPARED",
  "QUOTE_SENT",
  "NEGOTIATION",
  "WON",
];

export function solarStageReached(stage: SolarSalesStage, target: SolarSalesStage): boolean {
  if (stage === "LOST") return target === "LOST";
  if (target === "LOST") return false;
  return FUNNEL.indexOf(stage) >= FUNNEL.indexOf(target);
}
