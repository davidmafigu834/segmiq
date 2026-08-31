"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/sales/ui";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { RealEstateReportsWorkspace } from "@/components/real-estate/RealEstateReportsWorkspace";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyReReportsPage({
  chrome,
  clientId,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
}) {
  const router = useRouter();
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Reports"
      title="Reports"
      description="Enquiries, popular properties, viewings and conversions."
      primaryAction={
        <Button
          variant="primary"
          size="md"
          rightIcon={<ArrowUpRight size={15} />}
          onClick={() => router.push("/client/leads")}
        >
          View inquiries
        </Button>
      }
      titleActions={
        <Button
          variant="primary"
          size="md"
          className="layout:hidden"
          rightIcon={<ArrowUpRight size={15} />}
          onClick={() => router.push("/client/leads")}
        >
          View inquiries
        </Button>
      }
    >
      <RealEstateReportsWorkspace clientId={clientId} />
    </CompanyRePageFrame>
  );
}
