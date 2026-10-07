/**
 * WhatsApp solar opportunity read model.
 *
 * Stage still comes from getSolarSalesStage(). The next step starts from
 * solarPrimaryAction(), then accounts for two facts that function does not
 * see: a draft assessment that has real answers, and a work project that
 * already exists after Won.
 *
 * Active deal resolver (shared by the solar board, the stage cue, and this panel):
 * 1. If leads.active_deal_id points at an open deal on this lead, use it.
 * 2. Otherwise use the most recently updated open deal (not Won or Lost).
 * 3. Otherwise use active_deal_id even if that deal is closed.
 * 4. Otherwise use the most recently updated deal.
 * This does not rewrite historical deals. Selecting another open opportunity
 * updates only the lead's active_deal_id pointer.
 *
 * Relevant quotation, in order:
 * 1. An accepted quote.
 * 2. Otherwise a sent or viewed quote (viewed preferred, then latest sent_at).
 * 3. Otherwise an approved or pending-approval quote.
 * 4. Otherwise the latest draft.
 * A newer draft does not hide an older sent quote.
 */

import { getSolarSalesStage } from "./derive";
import { SOLAR_SALES_STAGE_LABEL } from "./labels";
import { solarPrimaryAction } from "./transitions";
import type { SolarQuoteFact, SolarSalesFacts, SolarSalesStage } from "./types";
import type { SolarAssessmentData } from "@/lib/work-projects/field-rules";
import { solarLoadSummary, solarOutcomeLabel } from "@/lib/work-projects/field-rules";

export const SOLAR_ASSESSMENT_SECTION_TOTAL = 7;

export type SolarPanelActionKind =
  | "contact"
  | "qualify"
  | "schedule_visit"
  | "open_visit"
  | "continue_assessment"
  | "prepare_proposal"
  | "send_quote"
  | "follow_up"
  | "mark_won"
  | "create_project"
  | "open_project"
  | "none";

export type SolarQuoteDisplayStatus =
  | "Draft"
  | "Pending approval"
  | "Approved"
  | "Sent"
  | "Viewed"
  | "Accepted"
  | "Rejected"
  | "Expired";

const OPEN_DEAL = (stage: string) => stage !== "WON" && stage !== "LOST";
const SENT_QUOTE = new Set(["sent", "viewed", "accepted", "rejected", "declined", "expired"]);

export function resolveSolarActiveDeal<T extends { id: string; stage: string; updated_at: string }>(
  deals: T[],
  preferredId: string | null | undefined
): T | null {
  if (!deals.length) return null;
  const open = deals.filter((deal) => OPEN_DEAL(deal.stage));
  const preferredOpen = preferredId ? open.find((deal) => deal.id === preferredId) : undefined;
  if (preferredOpen) return preferredOpen;
  if (open.length) return latest(open);
  const preferred = preferredId ? deals.find((deal) => deal.id === preferredId) : undefined;
  if (preferred) return preferred;
  return latest(deals);
}

function latest<T extends { updated_at: string }>(rows: T[]): T {
  return [...rows].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0]!;
}

function stamp(value: string | null | undefined): number {
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
}

export function selectRelevantQuotation<T extends SolarQuoteFact>(quotes: T[]): T | null {
  const rows = quotes.filter((quote) => quote.status !== "superseded");
  if (!rows.length) return null;
  const accepted = rows.filter((quote) => quote.status === "accepted");
  if (accepted.length) return newest(accepted, "sentAt");
  const sent = rows.filter((quote) => Boolean(quote.sentAt) || SENT_QUOTE.has(quote.status));
  if (sent.length) {
    const viewed = sent.filter(
      (quote) => quote.status === "viewed" || Boolean(quote.viewedAt) || (quote.viewCount ?? 0) > 0
    );
    return newest(viewed.length ? viewed : sent, "sentAt");
  }
  const waiting = rows.filter((quote) => {
    const status = quote.status.toLowerCase();
    const approval = (quote.approvalStatus ?? "").toLowerCase();
    return (
      status === "pending_approval" ||
      status === "approved" ||
      approval === "pending" ||
      approval === "required" ||
      approval === "approved"
    );
  });
  if (waiting.length) {
    const approved = waiting.filter(
      (quote) => quote.status === "approved" || (quote.approvalStatus ?? "").toLowerCase() === "approved"
    );
    return (approved.length ? approved : waiting)[0]!;
  }
  const drafts = rows.filter((quote) => quote.status === "draft" || !quote.sentAt);
  if (drafts.length) return newest(drafts, "createdAt");
  return newest(rows, "createdAt");
}

function newest<T extends SolarQuoteFact>(rows: T[], field: "sentAt" | "createdAt"): T {
  return [...rows].sort((a, b) => stamp(b[field] ?? b.createdAt) - stamp(a[field] ?? a.createdAt))[0]!;
}

export function quotationDisplayStatus(quote: SolarQuoteFact): SolarQuoteDisplayStatus {
  const status = quote.status.toLowerCase();
  if (status === "accepted") return "Accepted";
  if (status === "rejected" || status === "declined") return "Rejected";
  if (status === "expired") return "Expired";
  const sent = status === "sent" || status === "viewed" || Boolean(quote.sentAt);
  const viewed = status === "viewed" || Boolean(quote.viewedAt) || (quote.viewCount ?? 0) > 0;
  if (sent && viewed) return "Viewed";
  if (sent) return "Sent";
  const approval = (quote.approvalStatus ?? "").toLowerCase();
  if (status === "pending_approval" || approval === "pending" || approval === "required") return "Pending approval";
  if (status === "approved" || approval === "approved") return "Approved";
  return "Draft";
}

export function solarAssessmentSectionsDone(data: SolarAssessmentData): number {
  let count = 0;
  if (data.site.address || data.site.propertyType || data.site.accessNotes || data.site.siteContact) count += 1;
  if (Object.values(data.power).some(Boolean)) count += 1;
  if (data.loads.length > 0 || data.loadNotes) count += 1;
  if (Object.values(data.roof).some(Boolean)) count += 1;
  if (Object.values(data.equipment).some(Boolean)) count += 1;
  if (data.photos.length > 0) count += 1;
  if (data.outcome) count += 1;
  return count;
}

/** A copied site address from scheduling is not assessment progress. */
export function solarAssessmentInProgress(data: SolarAssessmentData): boolean {
  const addressOnly =
    Boolean(data.site.address) &&
    !data.site.propertyType &&
    !data.site.accessNotes &&
    !data.site.siteContact &&
    !Object.values(data.power).some(Boolean) &&
    data.loads.length === 0 &&
    !data.loadNotes &&
    !Object.values(data.roof).some(Boolean) &&
    !Object.values(data.equipment).some(Boolean) &&
    data.photos.length === 0 &&
    !data.outcome;
  if (addressOnly) return false;
  return solarAssessmentSectionsDone(data) > 0;
}

export function solarOpportunityAction(
  facts: SolarSalesFacts,
  extras: { assessmentInProgress: boolean; projectId: string | null }
): { label: string; kind: SolarPanelActionKind } {
  const stage = getSolarSalesStage(facts);
  if (!stage) return { label: "", kind: "none" };
  if (stage === "WON" && extras.projectId) return { label: "Open project", kind: "open_project" };
  if (stage === "SITE_VISIT_REQUIRED" && extras.assessmentInProgress) {
    return { label: "Continue assessment", kind: "continue_assessment" };
  }
  return { label: solarPrimaryAction(facts), kind: actionKind(solarPrimaryAction(facts)) };
}

function actionKind(label: string): SolarPanelActionKind {
  if (label === "Contact lead") return "contact";
  if (label === "Qualify") return "qualify";
  if (label === "Schedule site visit" || label === "Schedule visit") return "schedule_visit";
  if (label === "Open visit") return "open_visit";
  if (label === "Prepare proposal") return "prepare_proposal";
  if (label === "Send quote") return "send_quote";
  if (label === "Follow up") return "follow_up";
  if (label === "Mark deal won") return "mark_won";
  if (label === "Create project") return "create_project";
  return "none";
}

/**
 * WhatsApp presentation only. The Solar Sales board still uses solarPrimaryAction()
 * ("Contact lead", "Qualify"). Inside an open conversation the composer is the contact.
 */
export function solarWhatsAppNextStep(
  kind: SolarPanelActionKind,
  canonicalLabel: string
): { title: string | null; button: string | null; hint: string | null } {
  if (kind === "contact") {
    return {
      title: "Reply to this customer",
      button: null,
      hint: "Your first successful reply will move this opportunity to Contacted.",
    };
  }
  if (kind === "qualify") {
    return { title: "Qualify this lead", button: "Qualify Lead", hint: null };
  }
  const button = SOLAR_PANEL_ACTION_LABEL[canonicalLabel] || canonicalLabel || null;
  return { title: null, button, hint: null };
}

/** List label for a solar thread that has no deal yet. */
export function solarConversationListLabel(status: string): string {
  if (status === "NEW") return "New Lead";
  if (status === "CONTACTED") return "Contacted";
  if (status === "QUALIFIED" || status === "CONVERTED_TO_DEAL") return "Qualified";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export const SOLAR_PANEL_ACTION_LABEL: Record<string, string> = {
  "Contact lead": "Contact lead",
  Qualify: "Qualify",
  "Schedule site visit": "Schedule site visit",
  "Schedule visit": "Schedule site visit",
  "Open visit": "Open site visit",
  "Continue assessment": "Continue assessment",
  "Prepare proposal": "Prepare proposal",
  "Send quote": "Send quote",
  "Follow up": "Follow up",
  "Mark deal won": "Mark deal won",
  "Create project": "Create project",
  "Open project": "Open project",
};

const PANEL_PROGRESS = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "visit", label: "Site visit" },
  { id: "proposal", label: "Proposal" },
  { id: "quote", label: "Quote" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
] as const;

export function solarPanelProgress(stage: SolarSalesStage): Array<{ id: string; label: string; state: "done" | "current" | "upcoming" }> {
  const index =
    stage === "NEW_LEAD" || stage === "CONTACTED"
      ? 0
      : stage === "QUALIFIED"
        ? 1
        : stage === "SITE_VISIT_REQUIRED" || stage === "SITE_VISIT_COMPLETED"
          ? 2
          : stage === "PROPOSAL_PREPARED"
            ? 3
            : stage === "QUOTE_SENT"
              ? 4
              : stage === "NEGOTIATION"
                ? 5
                : stage === "WON"
                  ? 6
                  : -1;
  return PANEL_PROGRESS.map((step, stepIndex) => ({
    id: step.id,
    label: step.label,
    state: index < 0 ? "upcoming" : stepIndex < index ? "done" : stepIndex === index ? "current" : "upcoming",
  }));
}

export function solarPowerLines(data: SolarAssessmentData): string[] {
  const lines: string[] = [];
  if (data.power.gridAvailable === "yes") lines.push("Grid available");
  if (data.power.gridAvailable === "no") lines.push("No grid");
  if (data.power.generatorPresent === "yes") lines.push("Generator present");
  if (data.power.existingSolar === "yes") lines.push("Existing solar");
  return lines;
}

export function solarRoofLine(data: SolarAssessmentData): string | null {
  const parts = [data.roof.roofType, data.roof.shading].filter((part): part is string => Boolean(part?.trim()));
  return parts.length ? parts.join(" · ") : null;
}

export function solarMissingFacts(input: {
  stage: SolarSalesStage;
  location: string | null;
  budget: string | null;
  timeline: string | null;
  assessment: SolarAssessmentData | null;
  assessmentComplete: boolean;
}): string[] {
  if (
    input.stage === "SITE_VISIT_COMPLETED" ||
    input.stage === "PROPOSAL_PREPARED" ||
    input.stage === "QUOTE_SENT" ||
    input.stage === "NEGOTIATION" ||
    input.stage === "WON" ||
    input.stage === "LOST"
  ) {
    return [];
  }
  const missing: string[] = [];
  const address = input.assessment?.site.address?.trim() || input.location?.trim() || "";
  if (!address) missing.push("Exact site");
  if (!input.budget?.trim()) missing.push("Budget");
  if (!input.timeline?.trim()) missing.push("Timeline");
  const borehole = input.assessment?.loads.find((load) => /borehole/i.test(load.name));
  if (borehole && borehole.watts == null && !borehole.notes?.trim()) missing.push("Borehole rating");
  if (!input.assessmentComplete) missing.push("Roof and site assessment");
  return missing;
}

export function solarInsight(input: {
  stage: SolarSalesStage;
  quoteStatus: SolarQuoteDisplayStatus | null;
  projectId: string | null;
}): string | null {
  if (input.stage === "WON" && input.projectId) return null;
  if (input.stage === "WON") return "Sales is complete. Create a project to begin delivery.";
  if (input.stage === "SITE_VISIT_COMPLETED" && !input.quoteStatus) {
    return "The site assessment is complete and no proposal has been prepared yet.";
  }
  if (input.quoteStatus === "Accepted" && input.stage !== "LOST") return "The customer accepted the quotation.";
  if (input.stage === "PROPOSAL_PREPARED") return "A proposal exists and has not been sent.";
  if (input.quoteStatus === "Viewed") return "The quotation has been sent and viewed.";
  if (input.stage === "QUOTE_SENT") return "The quotation has been sent.";
  return null;
}

export function solarStageLabel(stage: SolarSalesStage): string {
  return SOLAR_SALES_STAGE_LABEL[stage];
}

export function essentialLoadLine(data: SolarAssessmentData): string | null {
  const summary = solarLoadSummary(data);
  if (!summary) return null;
  return summary.replace(/^Essential loads:\s*/i, "");
}

export function assessmentOutcomeLine(data: SolarAssessmentData): string | null {
  return solarOutcomeLabel(data.outcome);
}
