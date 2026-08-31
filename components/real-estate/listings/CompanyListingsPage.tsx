"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button } from "@/components/sales/ui";
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
  const [createNonce, setCreateNonce] = useState(0);

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Listings"
      title="Listings"
      description="Sale, rental, development and managed stock. Approve new listings before they become live inventory."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={15} strokeWidth={1.8} />}
          onClick={() => setCreateNonce((n) => n + 1)}
        >
          Add listing
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
          Add listing
        </Button>
      }
    >
      <ListingsManager
        clientId={clientId}
        hideAddButton
        headerCreateNonce={createNonce}
        onSelectionChange={setSelectedId}
      />
    </CompanyRePageFrame>
  );
}
