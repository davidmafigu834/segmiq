"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
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
import { SalesBreadcrumbs } from "@/components/sales/navigation/SalesBreadcrumbs";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
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
import { GuidedCourseMount } from "@/components/sales/training/GuidedCourseMount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/sales/ui";
import { SegmiQDotWave } from "@/components/dashboard/company/SegmiQDotWave";
import { useSalesSidebarCollapsed } from "@/lib/sales/navigation/use-sales-sidebar-collapsed";
import { cn } from "@/lib/ui/cn";
import type { UserRole } from "@/types";

export function SalesPageHeader({
  breadcrumb,
  title,
  description,
  actions,
  titleActions,
}: {
  breadcrumb?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleActions?: ReactNode;
}) {
  return (
    <header className="min-w-0">
      <div className="hidden items-center gap-3 layout:flex">
        {breadcrumb ? <SalesBreadcrumbs value={breadcrumb} /> : <span className="min-w-0" />}
        {actions ? (
          <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>

      <div className="min-w-0 layout:mt-3.5 layout:border-t layout:border-sales-border-subtle layout:pt-4">
        <div className="flex min-w-0 flex-col gap-3 layout:flex-row layout:items-start layout:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[24px] layout:text-[26px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-[42rem] text-[13px] leading-snug text-sales-text-secondary sm:mt-1.5 sm:text-[14px]">
                {description}
              </p>
            ) : null}
          </div>
          {titleActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 layout:justify-end">{titleActions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SalesQuickActions({
  onAddLead,
  onLogCall,
  realEstate = false,
}: {
  onAddLead?: () => void;
  onLogCall?: () => void;
  realEstate?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="relative hidden layout:block">
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          className="sales-btn-primary inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold text-[#11170A] shadow-sm transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
          aria-label="Quick actions"
          data-course-target="dashboard-quick-actions"
        >
          <Zap size={16} strokeWidth={1.8} aria-hidden />
          Quick actions
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {onAddLead ? (
            <DropdownMenuItem icon={<UserPlus size={16} strokeWidth={1.8} />} onSelect={onAddLead}>
              {realEstate ? "Add inquiry" : "Add lead"}
            </DropdownMenuItem>
          ) : null}
          {onLogCall ? (
            <DropdownMenuItem icon={<Phone size={16} strokeWidth={1.8} />} onSelect={onLogCall}>
              Log call
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            icon={<BrandIcon brand="whatsapp" size={16} />}
            onSelect={() => router.push("/sales/inbox")}
          >
            Open Sales Hub
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={
              realEstate ? (
                <Building2 size={16} strokeWidth={1.8} aria-hidden />
              ) : (
                <FileText size={16} strokeWidth={1.8} aria-hidden />
              )
            }
            onSelect={() => router.push(realEstate ? "/sales/listings" : "/sales/quotes")}
          >
            {realEstate ? "View listings" : "View quotations"}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<CalendarDays size={16} strokeWidth={1.8} />}
            onSelect={() => router.push("/sales/calendar")}
          >
            View calendar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
  titleActions,
  showDefaultHeader = true,
  showSearch = true,
  showQuickActions = true,
  onLogCall,
  className = "",
  searchPlaceholder,
  hideMobileChrome = false,
  contentFlush = false,
  realEstate = false,
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
  titleActions?: ReactNode;
  showDefaultHeader?: boolean;
  showSearch?: boolean;
  showQuickActions?: boolean;
  onLogCall?: () => void;
  className?: string;
  searchPlaceholder?: string;
  hideMobileChrome?: boolean;
  /** Full-height workspace (WhatsApp hub) — no page padding, column flex scroll */
  contentFlush?: boolean;
  realEstate?: boolean;
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
      <div className="hidden shrink-0 items-center gap-2 layout:flex">
        <div className="flex items-center gap-1">
          <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
          <SalesThemeToggle />
        </div>
        {showQuickActions ? (
          <SalesQuickActions onAddLead={openAddHubSheet} onLogCall={onLogCall} realEstate={realEstate} />
        ) : null}
        <SalesProfileMenu
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          compact
        />
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "sales-dashboard-premium dashboard-shell flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-none flex-col overflow-hidden bg-sales-bg text-sales-text-primary",
        className
      )}
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

      {!hideMobileChrome && !hideBottomNav ? (
        <SalesMobileTopBar
          isSolo={isSolo}
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
        />
      ) : null}

      <div className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div
          className={cn(
            contentFlush
              ? "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sales-mobile-scroll"
              : "sales-page-content relative min-h-0 min-w-0 flex-1 w-full max-w-none overflow-y-auto overscroll-contain sales-mobile-scroll",
            !contentFlush && dense && "sales-page-content--dense"
          )}
        >
          <SegmiQDotWave />
          <div
            className={
              contentFlush
                ? "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                : dense
                  ? "relative space-y-3"
                  : "relative space-y-3 layout:space-y-3"
            }
          >
            {showDefaultHeader && title ? (
              <SalesPageHeader
                breadcrumb={breadcrumb}
                title={title}
                description={description}
                actions={desktopActions}
                titleActions={titleActions}
              />
            ) : null}
            {children}
          </div>
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
            onCreateQuote={() => router.push(realEstate ? "/sales/listings" : "/sales/quotes")}
            onSchedule={() => router.push("/sales/calendar")}
            realEstate={realEstate}
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
        <GuidedCourseMount isSolo={props.isSolo}>
          <SalesAppShellInner {...props} />
        </GuidedCourseMount>
      </SalesMobileChromeProvider>
    </ToastProvider>
  );
}
