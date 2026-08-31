"use client";

import { type ReactNode } from "react";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import type { UserRole } from "@/types";

/** @deprecated Use SalesAppShell with contentFlush — preset for WhatsApp Sales Hub. */
export function WhatsAppSalesHubShell({
  children,
  userName,
  userRoleLabel = "Sales Executive",
  avatarUrl,
  unreadNotifications = 0,
  notificationRole = "SALESPERSON",
  whatsappBadge,
  tasksBadge,
  isSolo,
}: {
  children: ReactNode;
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  unreadNotifications?: number;
  notificationRole?: UserRole;
  whatsappBadge: number;
  tasksBadge: number;
  isSolo: boolean;
}) {
  return (
    <SalesAppShell
      userName={userName}
      userRoleLabel={userRoleLabel}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      tasksBadge={tasksBadge}
      isSolo={isSolo}
      showDefaultHeader={false}
      contentFlush
    >
      {children}
    </SalesAppShell>
  );
}
