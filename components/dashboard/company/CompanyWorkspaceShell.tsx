"use client";

import { type CSSProperties, type ReactNode } from "react";
import { CompanySidebar } from "@/components/company/navigation/CompanySidebar";
import { CompanyMobileTopBar } from "@/components/company/navigation/CompanyMobileTopBar";
import { CompanyBottomNav } from "@/components/company/navigation/CompanyBottomNav";
import { SegmiQDotWave } from "@/components/dashboard/company/SegmiQDotWave";
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
  immersive = false,
  hideMobileChrome = false,
  preferCollapsedSidebar = false,
}: {
  children: ReactNode;
  companyName?: string;
  companyLogoUrl?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge?: number;
  /** Full-height workspaces manage their own inner padding and scrolling. */
  immersive?: boolean;
  /** Used by single-pane mobile workspaces while a detail pane is open. */
  hideMobileChrome?: boolean;
  /** Workspace routes may prefer the compact sidebar only when no user preference exists yet. */
  preferCollapsedSidebar?: boolean;
}) {
  const { collapsed, toggleCollapsed, width } = useCompanySidebarCollapsed({
    preferCollapsedOnFirstVisit: preferCollapsedSidebar,
  });

  return (
    <div
      className="sales-dashboard-premium dashboard-shell flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-sales-bg text-sales-text-primary"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      data-hide-mobile-nav={hideMobileChrome ? "true" : "false"}
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

      {!hideMobileChrome ? (
        <CompanyMobileTopBar
          userName={userName}
          userRoleLabel="Company Manager"
          avatarUrl={avatarUrl}
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
        />
      ) : null}

      <div className="dashboard-canvas min-h-0 min-w-0 flex-1 transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        {immersive ? null : (
          <>
            <div className="segmiq-ambient-glow" aria-hidden />
            <SegmiQDotWave />
          </>
        )}
        <div
          className={
            immersive
              ? "relative z-[1] sales-mobile-scroll min-h-0 min-w-0 w-full max-w-none flex-1 overflow-hidden"
              : "relative z-[1] sales-mobile-scroll min-h-0 min-w-0 w-full max-w-none flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:px-6 layout:space-y-6 layout:px-8 layout:py-6"
          }
        >
          {children}
        </div>
      </div>

      {!hideMobileChrome ? <CompanyBottomNav whatsappBadge={whatsappBadge} /> : null}
    </div>
  );
}
