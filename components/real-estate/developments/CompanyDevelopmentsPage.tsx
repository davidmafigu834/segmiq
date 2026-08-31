"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/sales/ui";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { DevelopmentsManager } from "@/components/real-estate/DevelopmentsManager";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyDevelopmentsPage({
  chrome,
  clientId,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
}) {
  const [createNonce, setCreateNonce] = useState(0);
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Developments"
      title="Developments"
      description="New-development inventory: sold, available, and reserved units."
      primaryAction={
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={15} strokeWidth={1.8} />}
          onClick={() => setCreateNonce((n) => n + 1)}
        >
          Add development
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
          Add development
        </Button>
      }
    >
      <DevelopmentsManager clientId={clientId} hideAddButton headerCreateNonce={createNonce} />
    </CompanyRePageFrame>
  );
}
