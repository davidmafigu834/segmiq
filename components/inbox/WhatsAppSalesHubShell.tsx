"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SalesSidebar } from "@/components/sales/navigation/SalesSidebar";
import { SalesMobileTopBar } from "@/components/sales/navigation/SalesMobileTopBar";
import { SalesBottomNav } from "@/components/sales/navigation/SalesBottomNav";
import {
  SalesMoreSheet,
  SalesMobileQuickActionsSheet,
} from "@/components/sales/navigation/SalesMoreSheet";
import {
  SalesMobileChromeProvider,
  useSalesMobileChrome,
} from "@/components/sales/navigation/SalesMobileChromeContext";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import { useSalesSidebarCollapsed } from "@/lib/sales/navigation/use-sales-sidebar-collapsed";
import type { UserRole } from "@/types";

function HubShellInner({
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
  const router = useRouter();
  const { collapsed, toggleCollapsed, width } = useSalesSidebarCollapsed();
  const { setQuickActionsOpen, quickActionsOpen, hideBottomNav } = useSalesMobileChrome();
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct");

  return (
    <div
      className="sales-dashboard-premium flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-sales-bg text-sales-text-primary"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      data-hide-mobile-nav={hideBottomNav ? "true" : "false"}
      style={{ ["--sales-sidebar-current-width" as string]: `${width}px` } as CSSProperties}
    >
      <div className="hidden layout:contents">
        <SalesSidebar
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          isSolo={isSolo}
          whatsappBadge={whatsappBadge}
          tasksBadge={tasksBadge}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      {!hideBottomNav ? (
        <SalesMobileTopBar
          isSolo={isSolo}
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
        />
      ) : null}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>

      <SalesBottomNav isSolo={isSolo} whatsappBadge={whatsappBadge} tasksBadge={tasksBadge} />
      <SalesMoreSheet isSolo={isSolo} onQuickActions={() => setQuickActionsOpen(true)} />
      <SalesMobileQuickActionsSheet
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onAddLead={() => openAddHubSheet()}
        onLogCall={() => router.push("/sales/call-now")}
        onCreateQuote={() => router.push("/sales/quotes")}
        onSchedule={() => router.push("/sales/calendar")}
      />
      {hubSheet}
    </div>
  );
}

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
    <SalesMobileChromeProvider>
      <HubShellInner
        userName={userName}
        userRoleLabel={userRoleLabel}
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        whatsappBadge={whatsappBadge}
        tasksBadge={tasksBadge}
        isSolo={isSolo}
      >
        {children}
      </HubShellInner>
    </SalesMobileChromeProvider>
  );
}
