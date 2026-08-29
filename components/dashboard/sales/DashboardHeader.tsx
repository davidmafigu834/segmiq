"use client";

import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import {
  SalesPageHeader,
  SalesQuickActions,
} from "@/components/sales/shell/SalesAppShell";
import type { UserRole } from "@/types";
import { greetingPart } from "@/lib/sales/sales-dashboard-view";

export function DashboardHeader({
  firstName,
  userName,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  onOpenLog,
  onAddLead,
  description = "Here's what needs attention across your enquiries and deals today.",
  userRoleLabel = "Sales Executive",
  realEstate = false,
}: {
  firstName: string;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  onOpenLog: () => void;
  onAddLead: () => void;
  description?: string;
  userRoleLabel?: string;
  realEstate?: boolean;
}) {
  const greeting = `Good ${greetingPart()}, ${firstName}`;

  return (
    <SalesPageHeader
      breadcrumb="Sales / Dashboard"
      title={greeting}
      description={description}
      actions={
        <>
          <div className="sd-search-wrap hidden min-w-0 shrink layout:inline-flex">
            <GlobalSearch role={notificationRole} />
          </div>
          <div className="hidden shrink-0 items-center gap-2 layout:flex">
            <div className="flex items-center gap-1">
              <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
              <SalesThemeToggle />
            </div>
            <SalesQuickActions onAddLead={onAddLead} onLogCall={onOpenLog} realEstate={realEstate} />
            <SalesProfileMenu
              userName={userName}
              userRoleLabel={userRoleLabel}
              avatarUrl={avatarUrl}
              compact
            />
          </div>
        </>
      }
    />
  );
}
