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
      breadcrumb="Company / Listings"
      title="Listings"
      description="Houses opened from a completed seller form. Finish the ones that still need details or photos."
      primaryAction={null}
    >
      <ListingWorkList clientId={clientId} surface="client" />
    </CompanyRePageFrame>
  );
}
