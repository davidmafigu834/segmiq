"use client";

import type { ReactNode } from "react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { ToastProvider } from "@/components/sales/ui";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export function CompanyRePageFrame({
  chrome,
  breadcrumb,
  title,
  description,
  primaryAction,
  titleActions,
  hideMobileChrome,
  hideTitleBlock,
  children,
}: {
  chrome: CompanyPageChrome;
  breadcrumb: string;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  titleActions?: ReactNode;
  hideMobileChrome?: boolean;
  hideTitleBlock?: boolean;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <CompanyWorkspaceShell
        companyName={chrome.companyName}
        companyLogoUrl={chrome.companyLogoUrl}
        userName={chrome.userName}
        avatarUrl={chrome.avatarUrl}
        unreadNotifications={chrome.unreadNotifications}
        notificationRole={chrome.notificationRole}
        whatsappBadge={chrome.whatsappBadge}
        businessType="real_estate"
        hideMobileChrome={hideMobileChrome}
      >
        <CompanyDashboardHeader
          unreadNotifications={chrome.unreadNotifications}
          notificationRole={chrome.notificationRole}
          userName={chrome.userName}
          avatarUrl={chrome.avatarUrl}
          canAddLead={false}
          breadcrumb={breadcrumb}
          title={title}
          description={description}
          primaryAction={primaryAction}
          titleActions={titleActions}
          hideTitleBlock={hideTitleBlock}
        />
        {children}
      </CompanyWorkspaceShell>
    </ToastProvider>
  );
}
