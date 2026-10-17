"use client";

import { useState } from "react";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { ListingsManager } from "@/components/real-estate/ListingsManager";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyListingsPage({
  chrome,
  clientId,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
}) {
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Listings"
      title="Listings"
      description="Manage your agency property inventory, availability and activity."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={null}
    >
      <ListingsManager
        clientId={clientId}
        onSelectionChange={setSelectedId}
      />
    </CompanyRePageFrame>
  );
}
