import { getAgentCompanySettings, isAgentGloballyEnabled } from "@/lib/agent/settings";
import { isSalesAgentGloballyEnabled } from "./types";

export function salesAgentFlags(settings: {
  salesAgentEnabled: boolean;
  salesAgentCommandCenter: boolean;
  salesAgentSalesHubCommand: boolean;
  salesAgentQuotationCreation: boolean;
  salesAgentQuotationUpdate: boolean;
  salesAgentContextualExtraction: boolean;
}) {
  const on = isSalesAgentGloballyEnabled() && settings.salesAgentEnabled;
  return {
    enabled: on,
    commandCenter: on && settings.salesAgentCommandCenter,
    salesHubCommand: on && settings.salesAgentSalesHubCommand,
    quotationCreation: on && settings.salesAgentQuotationCreation,
    quotationUpdate: on && settings.salesAgentQuotationUpdate,
    contextualExtraction: on && settings.salesAgentContextualExtraction,
    allowDirectSend: false,
  };
}

export async function getSalesAgentFlags(clientId: string) {
  const settings = await getAgentCompanySettings(clientId);
  return salesAgentFlags(settings);
}

/** Model is optional: heuristic intent still works. LLM improves unstructured commands. */
export function salesAgentModelAvailable(): boolean {
  return isAgentGloballyEnabled();
}
