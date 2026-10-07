/**
 * Solar sales snapshot metrics.
 * Counts come from the current workflow and from real visit/quote facts.
 * Post-sale installation visits are not included.
 */

import { solarStageReached } from "./derive";
import type { SolarSalesStage } from "./types";

export type SolarMetricCard = {
  stage: SolarSalesStage;
  visitCompleted: boolean;
  quotePrepared: boolean;
  quoteSent: boolean;
};

export type SolarSalesReport = {
  newEnquiries: number;
  contactRate: number | null;
  qualificationRate: number | null;
  siteVisitRequired: number;
  siteVisitsCompleted: number;
  siteVisitToProposalRate: number | null;
  proposalPrepared: number;
  quotesSent: number;
  quoteToWonRate: number | null;
  negotiation: number;
  won: number;
  lost: number;
};

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function solarSalesReport(cards: SolarMetricCard[]): SolarSalesReport {
  const stageCount = (stage: SolarSalesStage) => cards.filter((card) => card.stage === stage).length;
  const contacted = cards.filter((card) => card.stage !== "NEW_LEAD").length;
  const qualified = cards.filter((card) => solarStageReached(card.stage, "QUALIFIED") || card.stage === "LOST").length;
  const visitsCompleted = cards.filter((card) => card.visitCompleted).length;
  const visitsThatProposed = cards.filter((card) => card.visitCompleted && (card.quotePrepared || card.quoteSent)).length;
  const quotesSent = cards.filter((card) => card.quoteSent).length;
  const won = stageCount("WON");
  return {
    newEnquiries: cards.length,
    contactRate: rate(contacted, cards.length),
    qualificationRate: rate(qualified, contacted),
    siteVisitRequired: stageCount("SITE_VISIT_REQUIRED"),
    siteVisitsCompleted: visitsCompleted,
    siteVisitToProposalRate: rate(visitsThatProposed, visitsCompleted),
    proposalPrepared: stageCount("PROPOSAL_PREPARED"),
    quotesSent,
    quoteToWonRate: rate(won, quotesSent),
    negotiation: stageCount("NEGOTIATION"),
    won,
    lost: stageCount("LOST"),
  };
}

export type SolarSalesQuestion =
  | "needs_site_visit"
  | "assessment_without_proposal"
  | "unsent_proposals"
  | "quote_follow_up";

export function classifySolarSalesQuestion(text: string): SolarSalesQuestion | null {
  const value = text.trim();
  if (/site visit/i.test(value) && /need|still|required|waiting/i.test(value)) return "needs_site_visit";
  if (/assessment/i.test(value) && /proposal|quote/i.test(value) && /no |without|not /i.test(value)) {
    return "assessment_without_proposal";
  }
  if (/proposal/i.test(value) && /not been sent|haven't been sent|havent been sent|unsent|haven't sent/i.test(value)) {
    return "unsent_proposals";
  }
  if (/quotes?/i.test(value) && /follow-?up|need follow/i.test(value)) return "quote_follow_up";
  return null;
}

export function solarQuestionStages(question: SolarSalesQuestion): SolarSalesStage[] {
  if (question === "needs_site_visit") return ["SITE_VISIT_REQUIRED"];
  if (question === "assessment_without_proposal") return ["SITE_VISIT_COMPLETED"];
  if (question === "unsent_proposals") return ["PROPOSAL_PREPARED"];
  return ["QUOTE_SENT", "NEGOTIATION"];
}
