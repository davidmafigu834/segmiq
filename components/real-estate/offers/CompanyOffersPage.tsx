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
}: {
  chrome: CompanyPageChrome;
  clientId: string;
}) {
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createNonce, setCreateNonce] = useState(0);

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Offers"
      title="Offers"
      description="Bids in play — seller response, counters, and accepted next steps."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={15} strokeWidth={1.8} />}
          onClick={() => setCreateNonce((n) => n + 1)}
        >
          Create offer
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
          Create offer
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
        onSelectionChange={setSelectedId}
      />
    </CompanyRePageFrame>
  );
}
