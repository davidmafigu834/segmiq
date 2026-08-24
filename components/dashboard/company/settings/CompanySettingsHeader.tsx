"use client";

import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import type { UserRole } from "@/types";

export function CompanySettingsHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
}) {
  return (
    <CompanyDashboardHeader
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      userName={userName}
      avatarUrl={avatarUrl}
      canAddLead={false}
      breadcrumb="Company / Settings"
      title="Settings"
      description="Manage your company account, preferences and system configuration."
      primaryAction={null}
    />
  );
}
