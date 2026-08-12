"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CompanySidebar } from "@/components/company/navigation/CompanySidebar";
import { CompanyMobileTopBar } from "@/components/company/navigation/CompanyMobileTopBar";
import { CompanyBottomNav } from "@/components/company/navigation/CompanyBottomNav";
import { useCompanySidebarCollapsed } from "@/lib/sales/navigation/use-company-sidebar-collapsed";
import type { UserRole } from "@/types";

export function CompanyWorkspaceShell({
  children,
  companyName,
  companyLogoUrl,
  userName,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  whatsappBadge = 0,
}: {
  children: ReactNode;
  companyName?: string;
  companyLogoUrl?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const { collapsed, toggleCollapsed, width } = useCompanySidebarCollapsed();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="sales-dashboard-premium flex h-full min-h-0 flex-1 flex-col bg-sales-bg" />
    );
  }

  return (
    <div
      className="sales-dashboard-premium flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-sales-bg text-sales-text-primary"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      style={{ ["--sales-sidebar-current-width" as string]: `${width}px` } as CSSProperties}
    >
      <div className="hidden layout:contents">
        <CompanySidebar
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          userName={userName}
          userRoleLabel="Company Manager"
          avatarUrl={avatarUrl}
          whatsappBadge={whatsappBadge}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      <CompanyMobileTopBar
        userName={userName}
        userRoleLabel="Company Manager"
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div className="sales-mobile-scroll min-h-0 min-w-0 w-full max-w-none flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:space-y-5 sm:px-6 layout:px-8 layout:py-6">
          {children}
        </div>
      </div>

      <CompanyBottomNav whatsappBadge={whatsappBadge} />
    </div>
  );
}
