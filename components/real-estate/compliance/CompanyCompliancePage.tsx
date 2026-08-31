"use client";

import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { ComplianceWorkspace } from "@/components/real-estate/compliance/ComplianceWorkspace";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { useState } from "react";

export function CompanyCompliancePage({
  chrome,
  clientId,
  initialTab,
  title = "Compliance",
  description = "Review client due diligence and transaction compliance.",
  breadcrumb = "Company / Compliance",
}: {
  chrome: CompanyPageChrome;
  clientId: string;
  initialTab?: "attention" | "under_review" | "edd" | "approved" | "restricted" | "all";
  title?: string;
  description?: string;
  breadcrumb?: string;
}) {
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb={breadcrumb}
      title={title}
      description={description}
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={null}
    >
      <ComplianceWorkspace
        clientId={clientId}
        initialTab={initialTab}
        onSelectionChange={setSelectedId}
      />
    </CompanyRePageFrame>
  );
}
