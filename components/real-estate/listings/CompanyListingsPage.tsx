"use client";

import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { ListingWorkList } from "@/components/real-estate/listings/ListingWorkList";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyListingsPage({
  chrome,
  clientId,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
}) {
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Properties"
      title="Properties"
      description="In preparation, on the market, and under offer."
      primaryAction={null}
    >
      <ListingWorkList clientId={clientId} surface="client" />
    </CompanyRePageFrame>
  );
}
