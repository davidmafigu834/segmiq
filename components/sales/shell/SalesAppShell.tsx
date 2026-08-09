"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Phone,
  UserPlus,
  Zap,
} from "lucide-react";
import { BrandIcon } from "@/components/sales/ui/BrandIcon";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesSidebar } from "@/components/sales/navigation/SalesSidebar";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
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
import { ToastProvider } from "@/components/sales/ui/Toast";
import { Button } from "@/components/sales/ui/Button";
import { useSalesSidebarCollapsed } from "@/lib/sales/navigation/use-sales-sidebar-collapsed";
import type { UserRole } from "@/types";

export function SalesPageHeader({
  breadcrumb,
  title,
  description,
  actions,
}: {
  breadcrumb?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-2 layout:space-y-1.5">
      {/* Desktop only — avoids empty min-h spacer pushing the title down on mobile */}
      <div className="hidden min-h-10 items-center justify-between gap-3 layout:flex">
        {breadcrumb ? (
          <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
            {breadcrumb}
          </p>
        ) : (
          <span className="min-w-0" />
        )}
        {actions ? (
          <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[26px] layout:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary sm:mt-1.5 sm:text-[14px]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SalesQuickActions({
  onAddLead,
  onLogCall,
}: {
  onAddLead?: () => void;
  onLogCall?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative hidden layout:block">
      <Button
        variant="primary"
        size="md"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Quick actions"
        onClick={() => setOpen((v) => !v)}
        leftIcon={<Zap size={16} strokeWidth={1.8} />}
        rightIcon={<ChevronDown size={14} strokeWidth={1.8} />}
      >
        Quick actions
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close quick actions"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-[40] mt-2 w-56 overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
          >
            {onAddLead ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onAddLead();
                }}
              >
                <UserPlus size={16} strokeWidth={1.8} aria-hidden />
                Add lead
              </button>
            ) : null}
            {onLogCall ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onLogCall();
                }}
              >
                <Phone size={16} strokeWidth={1.8} aria-hidden />
                Log call
              </button>
            ) : null}
            <Link
              href="/sales/inbox"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => setOpen(false)}
            >
              <BrandIcon brand="whatsapp" size={16} />
              Open Sales Hub
            </Link>
            <Link
              href="/sales/quotes"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => setOpen(false)}
            >
              <FileText size={16} strokeWidth={1.8} aria-hidden />
              View quotations
            </Link>
            <Link
              href="/sales/calendar"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => setOpen(false)}
            >
              <CalendarDays size={16} strokeWidth={1.8} aria-hidden />
              View calendar
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SalesAppShellInner({
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
  breadcrumb,
  title,
  description,
  dense = false,
  headerActions,
  showDefaultHeader = true,
  showSearch = true,
  showQuickActions = true,
  onLogCall,
  className = "",
  searchPlaceholder,
  hideMobileChrome = false,
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
  headerActions?: ReactNode;
  showDefaultHeader?: boolean;
  showSearch?: boolean;
  showQuickActions?: boolean;
  onLogCall?: () => void;
  className?: string;
  searchPlaceholder?: string;
  hideMobileChrome?: boolean;
}) {
  const router = useRouter();
  const { collapsed, toggleCollapsed, width } = useSalesSidebarCollapsed();
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps(assignmentMode);
  const { quickActionsOpen, setQuickActionsOpen, hideBottomNav } = useSalesMobileChrome();

  const desktopActions = (
    <>
      {showSearch ? (
        <div className="sd-search-wrap hidden min-w-0 shrink layout:inline-flex">
          <GlobalSearch role={notificationRole} placeholder={searchPlaceholder} />
        </div>
      ) : null}
      {headerActions}
      <div className="hidden shrink-0 items-center gap-1.5 layout:flex">
        <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
        {showQuickActions ? (
          <SalesQuickActions onAddLead={openAddHubSheet} onLogCall={onLogCall} />
        ) : null}
        <SalesProfileMenu
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
        />
      </div>
    </>
  );

  return (
    <div
      className={`sales-dashboard-premium flex h-full max-h-[100dvh] min-h-0 w-full max-w-none flex-col overflow-hidden bg-sales-bg text-sales-text-primary ${className}`}
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      data-hide-mobile-nav={hideBottomNav ? "true" : "false"}
      style={{ ["--sales-sidebar-current-width" as string]: `${width}px` } as CSSProperties}
    >
      {/* Desktop sidebar only — mobile uses bottom nav */}
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

      {!hideMobileChrome ? (
        <SalesMobileTopBar
          isSolo={isSolo}
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div
          className={[
            "sales-mobile-scroll min-h-0 min-w-0 flex-1 w-full max-w-none overflow-y-auto overscroll-contain",
            dense
              ? "space-y-4 px-4 pb-4 pt-3 sm:px-6 layout:px-7 layout:py-5"
              : "space-y-5 px-4 pb-4 pt-3 sm:px-6 layout:px-8 layout:py-6",
          ].join(" ")}
        >
          {showDefaultHeader && title ? (
            <SalesPageHeader
              breadcrumb={breadcrumb}
              title={title}
              description={description}
              actions={desktopActions}
            />
          ) : null}
          {children}
        </div>
      </div>

      {!hideMobileChrome ? (
        <>
          <SalesBottomNav
            isSolo={isSolo}
            whatsappBadge={whatsappBadge}
            tasksBadge={tasksBadge}
          />
          <SalesMoreSheet
            isSolo={isSolo}
            onQuickActions={() => setQuickActionsOpen(true)}
          />
          <SalesMobileQuickActionsSheet
            open={quickActionsOpen}
            onClose={() => setQuickActionsOpen(false)}
            onAddLead={() => openAddHubSheet()}
            onLogCall={() => {
              if (onLogCall) onLogCall();
              else router.push("/sales/call-now");
            }}
            onCreateQuote={() => router.push("/sales/quotes")}
            onSchedule={() => router.push("/sales/calendar")}
          />
        </>
      ) : null}

      {hubSheet}
    </div>
  );
}

export function SalesAppShell(props: Parameters<typeof SalesAppShellInner>[0]) {
  return (
    <ToastProvider>
      <SalesMobileChromeProvider>
        <SalesAppShellInner {...props} />
      </SalesMobileChromeProvider>
    </ToastProvider>
  );
}
