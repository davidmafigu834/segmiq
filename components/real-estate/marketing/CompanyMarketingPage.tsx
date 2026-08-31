"use client";

import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { RealEstateMarketingWorkspace } from "@/components/real-estate/marketing/RealEstateMarketingWorkspace";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyMarketingPage({
  chrome,
  clientId,
  clientName,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
  clientName: string;
}) {
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Marketing"
      title="Marketing"
      description="See which channels and campaigns are generating real property opportunities."
      primaryAction={null}
    >
      <RealEstateMarketingWorkspace clientId={clientId} clientName={clientName} />
    </CompanyRePageFrame>
  );
}
