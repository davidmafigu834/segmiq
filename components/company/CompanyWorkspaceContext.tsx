"use client";

import { createContext, useContext, type ReactNode } from "react";
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
};

const CompanyWorkspaceContext = createContext<CompanyWorkspaceValue>({
  businessType: "trades",
  terminology: getTerminology("trades"),
  isRealEstate: false,
  solarWorkflow: false,
  clientId: null,
});

export function CompanyWorkspaceProvider({
  businessType,
  solarWorkflow = false,
  clientId = null,
  children,
}: {
  businessType: BusinessType | string | null | undefined;
  solarWorkflow?: boolean;
  clientId?: string | null;
  children: ReactNode;
}) {
  const normalized = normalizeBusinessType(businessType);
  const value: CompanyWorkspaceValue = {
    businessType: normalized,
    terminology: getTerminology(normalized),
    isRealEstate: normalized === "real_estate",
    solarWorkflow,
    clientId,
  };
  return (
    <CompanyWorkspaceContext.Provider value={value}>{children}</CompanyWorkspaceContext.Provider>
  );
}

export function useCompanyWorkspace(): CompanyWorkspaceValue {
  return useContext(CompanyWorkspaceContext);
}
