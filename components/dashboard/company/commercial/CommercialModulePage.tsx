"use client";

import type { ReactNode } from "react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { ToastProvider } from "@/components/sales/ui";
import type { UserRole } from "@/types";

export function CommercialModulePage({
  chrome,
  breadcrumb,
  title,
  description,
  primaryAction,
  titleActions,
  hideTitleBlock = false,
  children,
}: {
  chrome: {
    companyName: string;
    companyLogoUrl?: string | null;
    userName: string;
    avatarUrl?: string | null;
    unreadNotifications: number;
    notificationRole: UserRole;
    whatsappBadge?: number;
  };
  breadcrumb: string;
  title?: string;
  description?: string;
  primaryAction?: ReactNode;
  titleActions?: ReactNode;
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
      >
        <CompanyDashboardHeader
          unreadNotifications={chrome.unreadNotifications}
          notificationRole={chrome.notificationRole}
          userName={chrome.userName}
          avatarUrl={chrome.avatarUrl}
          canAddLead
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
