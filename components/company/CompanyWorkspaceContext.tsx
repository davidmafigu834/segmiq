"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspacePlanBadge } from "@/lib/billing/workspace-plan-badge";
import {
  getTerminology,
  normalizeBusinessType,
  type BusinessType,
  type Terminology,
} from "@/lib/terminology";

type CompanyWorkspaceValue = {
  businessType: BusinessType;
  terminology: Terminology;
  isRealEstate: boolean;
  solarWorkflow: boolean;
  clientId: string | null;
  userId: string | null;
  planBadge: WorkspacePlanBadge | null;
};

const CompanyWorkspaceContext = createContext<CompanyWorkspaceValue>({
  businessType: "trades",
  terminology: getTerminology("trades"),
  isRealEstate: false,
  solarWorkflow: false,
  clientId: null,
  userId: null,
  planBadge: null,
});

export function CompanyWorkspaceProvider({
  businessType,
  solarWorkflow = false,
  clientId = null,
  userId = null,
  planBadge = null,
  children,
}: {
  businessType: BusinessType | string | null | undefined;
  solarWorkflow?: boolean;
  clientId?: string | null;
  userId?: string | null;
  planBadge?: WorkspacePlanBadge | null;
  children: ReactNode;
}) {
  const normalized = normalizeBusinessType(businessType);
  const value: CompanyWorkspaceValue = {
    businessType: normalized,
    terminology: getTerminology(normalized),
    isRealEstate: normalized === "real_estate",
    solarWorkflow,
    clientId,
    userId,
    planBadge,
  };
  return (
    <CompanyWorkspaceContext.Provider value={value}>{children}</CompanyWorkspaceContext.Provider>
  );
}

export function useCompanyWorkspace(): CompanyWorkspaceValue {
  return useContext(CompanyWorkspaceContext);
}
