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
}: {
  firstName: string;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  onOpenLog: () => void;
  onAddLead: () => void;
}) {
  const greeting = `Good ${greetingPart()}, ${firstName}`;

  return (
    <SalesPageHeader
      breadcrumb="Sales / Dashboard"
      title={greeting}
      description="Here’s what’s happening with your pipeline today."
      actions={
        <>
          <div className="sd-search-wrap hidden min-w-0 shrink layout:inline-flex">
            <GlobalSearch role={notificationRole} />
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 layout:flex">
            <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
            <SalesThemeToggle />
            <SalesQuickActions onAddLead={onAddLead} onLogCall={onOpenLog} />
            <SalesProfileMenu
              userName={userName}
              userRoleLabel="Sales Executive"
              avatarUrl={avatarUrl}
            />
          </div>
        </>
      }
    />
  );
}
