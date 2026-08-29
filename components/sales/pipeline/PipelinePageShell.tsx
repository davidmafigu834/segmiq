"use client";

import type { ReactNode } from "react";
import { SalesAppShell, SalesPageHeader, SalesQuickActions } from "@/components/sales/shell/SalesAppShell";
import type { UserRole } from "@/types";

/** Thin compatibility wrapper — new pages should use SalesAppShell directly. */
export function PipelinePageShell({
  children,
  userName,
  userRoleLabel = "Sales Executive",
  avatarUrl,
  unreadNotifications,
  notificationRole,
  whatsappBadge,
  tasksBadge,
  isSolo,
  assignmentMode = "direct",
  breadcrumb = "Sales / Pipeline",
  title = "My pipeline",
  description = "Track and manage the Deals you're actively working to win.",
  dense = true,
  searchPlaceholder = "Search Deals, customers...",
}: {
  children: ReactNode;
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
  tasksBadge: number;
  isSolo: boolean;
  assignmentMode?: "direct" | "pool" | "round_robin";
  breadcrumb?: string;
  title?: string;
  description?: string;
  dense?: boolean;
  searchPlaceholder?: string;
}) {
  return (
    <SalesAppShell
      className="pipeline-premium"
      userName={userName}
      userRoleLabel={userRoleLabel}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      tasksBadge={tasksBadge}
      isSolo={isSolo}
      assignmentMode={assignmentMode}
      breadcrumb={breadcrumb}
      title={title}
      description={description}
      dense={dense}
      searchPlaceholder={searchPlaceholder}
    >
      {children}
    </SalesAppShell>
  );
}

export { SalesAppShell, SalesPageHeader, SalesQuickActions };
