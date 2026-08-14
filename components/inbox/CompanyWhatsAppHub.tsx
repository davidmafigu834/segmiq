"use client";

import { useState } from "react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { ToastProvider } from "@/components/sales/ui/Toast";
import type { UserRole } from "@/types";
import { TeamInbox } from "./TeamInbox";

type MobilePane = "list" | "thread" | "intel";

export function CompanyWhatsAppHub({
  userName,
  userId,
  clientId,
  alsoSells,
  companyName,
  companyLogoUrl,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  whatsappBadge,
  salespeople,
}: {
  userName: string;
  userId: string;
  clientId: string;
  alsoSells: boolean;
  companyName: string;
  companyLogoUrl?: string | null;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
  salespeople: { id: string; name: string }[];
}) {
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");

  return (
    <ToastProvider>
      <CompanyWorkspaceShell
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        userName={userName}
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        whatsappBadge={whatsappBadge}
        immersive
        preferCollapsedSidebar
        hideMobileChrome={mobilePane !== "list"}
      >
        <TeamInbox
          userName={userName}
          userId={userId}
          role="CLIENT_MANAGER"
          alsoSells={alsoSells}
          clientId={clientId}
          roleSubtitle={`Company Manager · ${companyName}`}
          pipelineHref="/client/leads/pipeline"
          teamHref="/client/team"
          settingsHref="/client/account"
          inboxHref="/client/inbox"
          backHref="/client/dashboard"
          initialSalespeople={salespeople}
          pageTitle="WhatsApp Sales Hub"
          breadcrumb="WHATSAPP SALES HUB"
          companyMode
          unreadNotifications={unreadNotifications}
          avatarUrl={avatarUrl}
          onMobilePaneChange={setMobilePane}
        />
      </CompanyWorkspaceShell>
    </ToastProvider>
  );
}
