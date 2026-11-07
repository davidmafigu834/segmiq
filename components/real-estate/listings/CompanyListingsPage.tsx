"use client";

import { useState } from "react";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { ListingsManager } from "@/components/real-estate/ListingsManager";
import { PropertyRegister } from "@/components/real-estate/properties/PropertyRegister";
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
      breadcrumb="Company / Properties"
      title="Properties"
      description="Seller opportunities and the agency listing register."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={null}
    >
      <div className="space-y-4">
        <PropertyRegister clientId={clientId} surface="client" />
        <ListingsManager
          clientId={clientId}
          onSelectionChange={setSelectedId}
        />
      </div>
    </CompanyRePageFrame>
  );
}
