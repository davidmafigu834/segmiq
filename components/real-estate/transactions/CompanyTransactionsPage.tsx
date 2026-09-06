"use client";

import { useState } from "react";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { TransactionsWorkspace } from "./TransactionsWorkspace";

export function CompanyTransactionsPage({
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
      breadcrumb="Company / Transactions"
      title="Transactions"
      description="Agreements, deposits, conveyancing, and completion after an accepted offer."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
    >
      <TransactionsWorkspace
        clientId={clientId}
        variant="manager"
        onSelectionChange={setSelectedId}
      />
    </CompanyRePageFrame>
  );
}
