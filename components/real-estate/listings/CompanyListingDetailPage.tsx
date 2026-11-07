"use client";

import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { ListingDetailView } from "@/components/real-estate/ListingDetailView";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyListingDetailPage({
  chrome,
  clientId,
  listingId,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
  listingId: string;
}) {
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Listing"
      title="Listing"
      description="Finish this house, then share a viewing form."
      hideTitleBlock
    >
      <ListingDetailView clientId={clientId} listingId={listingId} surface="client" framed />
    </CompanyRePageFrame>
  );
}
