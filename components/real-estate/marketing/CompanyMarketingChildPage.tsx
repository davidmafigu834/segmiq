"use client";

import type { ReactNode } from "react";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyMarketingChildPage({
  chrome,
  title,
  description,
  breadcrumb = "Company / Marketing",
  children,
}: {
  chrome: CompanyPageChrome;
  title: string;
  description: string;
  breadcrumb?: string;
  children: ReactNode;
}) {
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb={breadcrumb}
      title={title}
      description={description}
      primaryAction={null}
    >
      {children}
    </CompanyRePageFrame>
  );
}
