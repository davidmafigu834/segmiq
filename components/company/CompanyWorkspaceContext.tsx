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
};

const CompanyWorkspaceContext = createContext<CompanyWorkspaceValue>({
  businessType: "trades",
  terminology: getTerminology("trades"),
  isRealEstate: false,
});

export function CompanyWorkspaceProvider({
  businessType,
  children,
}: {
  businessType: BusinessType | string | null | undefined;
  children: ReactNode;
}) {
  const normalized = normalizeBusinessType(businessType);
  const value: CompanyWorkspaceValue = {
    businessType: normalized,
    terminology: getTerminology(normalized),
    isRealEstate: normalized === "real_estate",
  };
  return (
    <CompanyWorkspaceContext.Provider value={value}>{children}</CompanyWorkspaceContext.Provider>
  );
}

export function useCompanyWorkspace(): CompanyWorkspaceValue {
  return useContext(CompanyWorkspaceContext);
}
