"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { Button } from "@/components/sales/ui";
import { QuoteSettingsManager } from "@/components/client-settings/QuoteSettingsManager";
import type { UserRole } from "@/types";

export function CompanyQuoteSettingsPage({
  clientId,
  companyName,
  companyLogoUrl,
  userName,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  whatsappBadge = 0,
}: {
  clientId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge?: number;
}) {
  const router = useRouter();

  return (
    <CompanyWorkspaceShell
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        userName={userName}
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        whatsappBadge={whatsappBadge}
      >
        <CompanyDashboardHeader
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
          userName={userName}
          avatarUrl={avatarUrl}
          canAddLead
          breadcrumb="Company / Quotations / Settings"
          title="Quotation settings"
          description="Set the commercial rules, catalog and customer experience for every offer your team sends."
          primaryAction={
            <Button
              variant="secondary"
              size="md"
              leftIcon={<ArrowLeft size={15} />}
              onClick={() => router.push("/client/quotations")}
            >
              Back to quotations
            </Button>
          }
        />
        <QuoteSettingsManager clientId={clientId} />
      </CompanyWorkspaceShell>
  );
}
