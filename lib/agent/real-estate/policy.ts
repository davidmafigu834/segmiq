import type { AgentPolicyDecision } from "../types";
import type { RealEstateAgentSettings } from "./types";

export const RE_AGENT_TOOL_NAMES = [
  "listing.search",
  "listing.get",
  "property.match",
  "buyer_requirements.update",
  "listing.send_match",
  "viewing.get_availability",
  "viewing.request_approval",
  "viewing.schedule",
] as const;

export type ReAgentToolName = (typeof RE_AGENT_TOOL_NAMES)[number];

/** Read-only RE tools allowed while drafting in ASSIST mode. */
export const RE_ASSIST_SAFE_TOOLS: ReadonlySet<ReAgentToolName> = new Set([
  "listing.search",
  "listing.get",
  "property.match",
  "viewing.get_availability",
]);

export function isReAgentTool(name: string): name is ReAgentToolName {
  return (RE_AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

export function evaluateRealEstateToolPolicy(
  toolName: ReAgentToolName,
  re: RealEstateAgentSettings | undefined
): AgentPolicyDecision {
  if (!re) {
    return { allowed: false, reason: "Real estate tools are not available for this company." };
  }
  switch (toolName) {
    case "listing.search":
    case "listing.get":
    case "property.match":
      return re.allowPropertySearch
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Property search is disabled in Real Estate Agent settings.",
          };
    case "listing.send_match":
      return re.allowSendPropertyInfo
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Sending property information is disabled in Real Estate Agent settings.",
          };
    case "buyer_requirements.update":
      return re.allowUpdateBuyerRequirements
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Updating buyer requirements is disabled in Real Estate Agent settings.",
          };
    case "viewing.get_availability":
      return re.allowOfferViewingSlots
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Offering viewing slots is disabled in Real Estate Agent settings.",
          };
    case "viewing.request_approval":
      return { allowed: true };
    case "viewing.schedule":
      return re.allowConfirmViewings
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Autonomous viewing confirmation is disabled. Use viewing.request_approval instead.",
          };
  }
}
