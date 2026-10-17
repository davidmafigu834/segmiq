import type { ReactNode } from "react";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import type { UserRole } from "@/types";

/** Company sidebar, mobile chrome, and toolbar around a workspace that already has its own page title. */
export async function CompanyReShell({
  userId,
  clientId,
  userName,
  role,
  breadcrumb,
  title,
  description,
  children,
}: {
  userId: string;
  clientId: string;
  userName: string;
  role: UserRole;
  breadcrumb: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const chrome = await loadCompanyPageChrome({ userId, clientId, userName, role });
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb={breadcrumb}
      title={title}
      description={description}
      primaryAction={null}
      hideTitleBlock
    >
      {children}
    </CompanyRePageFrame>
  );
}
