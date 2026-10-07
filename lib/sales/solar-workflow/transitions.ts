/**
 * Central solar transition rules.
 * Dragging a card never invents a visit, a quotation, or a sent quote.
 */

import { getSolarSalesStage, quoteAccepted, quoteLayer, visitCompleted } from "./derive";
import type { SolarSalesFacts, SolarSalesStage, SolarTransitionAction } from "./types";

export type SolarTransitionResult = {
  allowed: boolean;
  persisted: boolean;
  action: SolarTransitionAction;
  message: string;
  createsWorkProject: boolean;
};

const ORDER: SolarSalesStage[] = [
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

function step(stage: SolarSalesStage): number {
  return ORDER.indexOf(stage);
}

export function solarPrimaryAction(facts: SolarSalesFacts): string {
  const stage = getSolarSalesStage(facts);
  if (!stage) return "";
  if (stage === "NEW_LEAD") return "Contact lead";
  if (stage === "CONTACTED") return "Qualify";
  if (stage === "QUALIFIED") return "Schedule site visit";
  if (stage === "SITE_VISIT_REQUIRED") {
    return facts.visits.some((visit) => visit.status === "SCHEDULED" || visit.status === "ON_SITE" || visit.status === "RESCHEDULED")
      ? "Open visit"
      : "Schedule visit";
  }
  if (stage === "SITE_VISIT_COMPLETED") return "Prepare proposal";
  if (stage === "PROPOSAL_PREPARED") return "Send quote";
  if (quoteAccepted(facts.quotes) && (stage === "QUOTE_SENT" || stage === "NEGOTIATION")) return "Mark deal won";
  if (stage === "QUOTE_SENT") return "Follow up";
  if (stage === "NEGOTIATION") return "Mark deal won";
  if (stage === "WON") return "Create project";
  return "";
}

export function transitionSolarSalesStage(
  facts: SolarSalesFacts,
  target: SolarSalesStage
): SolarTransitionResult {
  if (facts.preset !== "SOLAR_INSTALLATION") {
    return {
      allowed: false,
      persisted: false,
      action: "none",
      message: "This company uses the general trades sales workflow.",
      createsWorkProject: false,
    };
  }

  const current = getSolarSalesStage(facts);
  if (!current) {
    return {
      allowed: false,
      persisted: false,
      action: "none",
      message: "This lead is not on the solar sales workflow.",
      createsWorkProject: false,
    };
  }
  if (current === target) {
    return {
      allowed: true,
      persisted: false,
      action: "none",
      message: "Already on this stage.",
      createsWorkProject: false,
    };
  }
  if (current === "WON" || current === "LOST") {
    return {
      allowed: false,
      persisted: false,
      action: "none",
      message: "This opportunity is already closed.",
      createsWorkProject: false,
    };
  }

  if (target === "LOST") {
    if (!facts.dealStage) {
      return {
        allowed: false,
        persisted: false,
        action: "none",
        message: "Create the opportunity before marking it lost.",
        createsWorkProject: false,
      };
    }
    return {
      allowed: true,
      persisted: false,
      action: "mark_lost",
      message: "Choose a lost reason. No work project is created.",
      createsWorkProject: false,
    };
  }

  if (target === "WON") {
    if (current !== "NEGOTIATION" && current !== "QUOTE_SENT") {
      return {
        allowed: false,
        persisted: false,
        action: "none",
        message: "Mark the deal won after the quotation has been sent.",
        createsWorkProject: false,
      };
    }
    return {
      allowed: true,
      persisted: false,
      action: "mark_won",
      message: "Use Mark Deal Won. A work project is not created until you ask for one.",
      createsWorkProject: false,
    };
  }

  const from = step(current);
  const to = step(target);
  if (from < 0 || to < 0 || to > from + 1) {
    return {
      allowed: false,
      persisted: false,
      action: "none",
      message: "Move one stage at a time. Earlier steps still need to happen.",
      createsWorkProject: false,
    };
  }

  if (target === "CONTACTED" && current === "NEW_LEAD") {
    return { allowed: true, persisted: true, action: "update_lead", message: "Marked as contacted.", createsWorkProject: false };
  }
  if (target === "QUALIFIED" && current === "CONTACTED") {
    return { allowed: true, persisted: true, action: "update_lead", message: "Marked as qualified.", createsWorkProject: false };
  }
  if (target === "SITE_VISIT_REQUIRED" && current === "QUALIFIED") {
    return {
      allowed: true,
      persisted: true,
      action: "require_visit",
      message: "Site visit required. Schedule it when you are ready.",
      createsWorkProject: false,
    };
  }
  if (target === "SITE_VISIT_COMPLETED") {
    if (!visitCompleted(facts.visits)) {
      return {
        allowed: false,
        persisted: false,
        action: "complete_visit",
        message: "Complete the site assessment before this stage.",
        createsWorkProject: false,
      };
    }
    return { allowed: true, persisted: false, action: "none", message: "The completed assessment already sets this stage.", createsWorkProject: false };
  }
  if (target === "PROPOSAL_PREPARED") {
    if (quoteLayer(facts.quotes) === "NONE") {
      return {
        allowed: true,
        persisted: false,
        action: "create_quote",
        message: "Create the quotation. The stage updates when a draft exists.",
        createsWorkProject: false,
      };
    }
    return { allowed: true, persisted: false, action: "none", message: "A quotation already sets this stage.", createsWorkProject: false };
  }
  if (target === "QUOTE_SENT") {
    if (quoteLayer(facts.quotes) !== "SENT") {
      return {
        allowed: true,
        persisted: false,
        action: "send_quote",
        message: "Send the quotation. The stage updates only after send succeeds.",
        createsWorkProject: false,
      };
    }
    return { allowed: true, persisted: false, action: "none", message: "The sent quotation already sets this stage.", createsWorkProject: false };
  }
  if (target === "NEGOTIATION") {
    if (quoteLayer(facts.quotes) !== "SENT") {
      return {
        allowed: false,
        persisted: false,
        action: "send_quote",
        message: "Send the quotation before negotiation.",
        createsWorkProject: false,
      };
    }
    return {
      allowed: true,
      persisted: true,
      action: "negotiate",
      message: "Moved into negotiation.",
      createsWorkProject: false,
    };
  }

  return {
    allowed: false,
    persisted: false,
    action: "none",
    message: "That move is not available from the current stage.",
    createsWorkProject: false,
  };
}
