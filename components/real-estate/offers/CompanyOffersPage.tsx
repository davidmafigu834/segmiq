"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button } from "@/components/sales/ui";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { OffersWorkspace } from "./OffersWorkspace";

export function CompanyOffersPage({
  chrome,
  clientId,
  initialListingId = null,
  initialContactId = null,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
  initialListingId?: string | null;
  initialContactId?: string | null;
}) {
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createNonce, setCreateNonce] = useState(0);

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Offers"
      title="Offers"
      description="Offer letters from a buyer. The seller reviews the letter after the buyer fills it."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={15} strokeWidth={1.8} />}
          onClick={() => setCreateNonce((n) => n + 1)}
        >
          Generate offer letter
        </Button>
      }
      titleActions={
        <Button
          variant="primary"
          size="md"
          className="layout:hidden"
          leftIcon={<Plus size={15} strokeWidth={1.8} />}
          onClick={() => setCreateNonce((n) => n + 1)}
        >
          Generate offer letter
        </Button>
      }
    >
      <OffersWorkspace
        clientId={clientId}
        variant="manager"
        inquiriesHref="/client/leads"
        complianceHref="/client/compliance"
        hideCreateButton
        headerCreateNonce={createNonce}
        initialListingId={initialListingId}
        initialContactId={initialContactId}
        onSelectionChange={setSelectedId}
      />
    </CompanyRePageFrame>
  );
}
