import { isRealEstate, normalizeBusinessType, type BusinessType } from "@/lib/terminology";
import { isSalesWorkflowPreset, type SalesWorkflowPreset } from "@/lib/sales/solar-workflow/types";

export const SALES_EXPERIENCES = ["GENERAL", "REAL_ESTATE", "SOLAR"] as const;
export type SalesExperienceId = (typeof SALES_EXPERIENCES)[number];

/** Which home screen the salesperson lands on (web: /solo/dashboard vs /sales/dashboard). */
export type SalesHomeVariant = "SOLO" | "TEAM";

export type SalesExperienceResolvedBy = "BUSINESS_TYPE" | "SALES_WORKFLOW_PRESET" | "DEFAULT";

export type ClientMode = "solo" | "team";
export type WorkspaceMode = "production" | "demo";

export type SalesExperienceInput = {
  role: string;
  clientMode: string | null | undefined;
  businessType: string | null | undefined;
  salesWorkflowPreset: string | null | undefined;
  workspaceMode?: string | null | undefined;
};

export type ResolvedSalesExperience = {
  id: SalesExperienceId;
  resolvedBy: SalesExperienceResolvedBy;
  homeVariant: SalesHomeVariant;
  clientMode: ClientMode;
  workspaceMode: WorkspaceMode;
  businessType: BusinessType;
  salesWorkflowPreset: SalesWorkflowPreset;
};

export function normalizeClientMode(value: unknown): ClientMode {
  return value === "solo" ? "solo" : "team";
}

export function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "demo" ? "demo" : "production";
}

export function normalizeSalesWorkflowPreset(value: unknown): SalesWorkflowPreset {
  return typeof value === "string" && isSalesWorkflowPreset(value) ? value : "GENERAL_TRADES";
}

/**
 * Same precedence as app/sales/layout.tsx + middleware:
 * solo selects the home variant (only a SALESPERSON in a solo organisation is
 * routed to /solo), demo workspaces resolve from their own business_type and
 * preset like any organisation, real estate wins over solar, then general.
 * Callers must have validated the session and salesperson eligibility first.
 */
export function resolveSalesExperience(input: SalesExperienceInput): ResolvedSalesExperience {
  const clientMode = normalizeClientMode(input.clientMode);
  const businessType = normalizeBusinessType(input.businessType);
  const salesWorkflowPreset = normalizeSalesWorkflowPreset(input.salesWorkflowPreset);
  const homeVariant: SalesHomeVariant =
    input.role === "SALESPERSON" && clientMode === "solo" ? "SOLO" : "TEAM";
  const base = {
    homeVariant,
    clientMode,
    workspaceMode: normalizeWorkspaceMode(input.workspaceMode),
    businessType,
    salesWorkflowPreset,
  };
  if (isRealEstate(businessType)) {
    return { ...base, id: "REAL_ESTATE", resolvedBy: "BUSINESS_TYPE" };
  }
  if (salesWorkflowPreset === "SOLAR_INSTALLATION") {
    return { ...base, id: "SOLAR", resolvedBy: "SALES_WORKFLOW_PRESET" };
  }
  return { ...base, id: "GENERAL", resolvedBy: "DEFAULT" };
}
