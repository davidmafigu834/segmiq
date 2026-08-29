"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { SalesNavItem, SalesNavSection } from "@/components/sales/navigation/SalesNavItem";
import {
  displaySalesName,
  resolveSalesNavItems,
  salesNameInitials,
  salesNavItemsBySection,
  type SalesNavBadgeKey,
} from "@/lib/sales/navigation/sales-nav-config";
import { cn } from "@/lib/ui/cn";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";

export function SalesSidebar({
  userName,
  userRoleLabel = "Sales Executive",
  avatarUrl,
  isSolo,
  whatsappBadge,
  tasksBadge,
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapsed,
}: {
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  isSolo: boolean;
  whatsappBadge: number;
  tasksBadge: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { businessType } = useCompanyWorkspace();
  const pathname = usePathname();
  const crmTheme = useCrmThemeOptional();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";
  const items = resolveSalesNavItems(isSolo, businessType);
  const salesItems = salesNavItemsBySection(items, "sales");
  const toolsItems = salesNavItemsBySection(items, "tools");
  const dashboardHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";

  const badges: Partial<Record<SalesNavBadgeKey, number>> = {
    whatsapp: whatsappBadge,
    tasks: tasksBadge,
  };

  function body(opts: { drawer: boolean; collapsedMode: boolean }) {
    const { drawer, collapsedMode } = opts;
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-[var(--sales-sidebar-bg)]">
        <div
          className={cn(
            "relative flex shrink-0 items-center",
            collapsedMode ? "h-[68px] justify-center px-2" : "h-[72px] justify-between gap-2 px-5"
          )}
        >
          <Link
            href={dashboardHref}
            onClick={onCloseMobile}
            className="flex min-w-0 items-center focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
          >
            {collapsedMode ? (
              <Image
                src="/brand/segmiq-q.png"
                alt="SegmiQ"
                width={28}
                height={28}
                priority
                className="h-7 w-7 object-contain"
              />
            ) : (
              <Image
                src={wordmarkSrc}
                alt="SegmiQ"
                width={100}
                height={24}
                priority
                className="h-6 w-auto max-w-[100px] object-contain object-left"
              />
            )}
          </Link>

          {drawer ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)]"
              aria-label="Close menu"
              onClick={onCloseMobile}
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          ) : onToggleCollapsed && !collapsedMode ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeftClose size={16} strokeWidth={1.8} />
            </button>
          ) : null}

          {onToggleCollapsed && collapsedMode && !drawer ? (
            <button
              type="button"
              className="absolute bottom-1 left-1/2 inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeftOpen size={14} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-3"
          aria-label="Sales navigation"
        >
          <SalesNavSection label="Sales" collapsed={collapsedMode}>
            {salesItems.map((item) => (
              <SalesNavItem
                key={item.id}
                item={item}
                active={item.match(pathname)}
                badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                collapsed={collapsedMode}
                onNavigate={onCloseMobile}
              />
            ))}
          </SalesNavSection>

          <div className={cn(collapsedMode ? "mt-4" : "mt-5")}>
            <SalesNavSection label="Tools" collapsed={collapsedMode}>
              {toolsItems.map((item) => (
                <SalesNavItem
                  key={item.id}
                  item={item}
                  active={item.match(pathname)}
                  collapsed={collapsedMode}
                  onNavigate={onCloseMobile}
                />
              ))}
              {collapsedMode ? (
                <a
                  href="/sales/training"
                  title="Help & Support"
                  aria-label="Help & Support"
                  data-course-target="sales-nav-training"
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)]"
                  onClick={onCloseMobile}
                >
                  <CircleHelp size={17} strokeWidth={1.75} aria-hidden />
                </a>
              ) : (
                <a
                  href="/sales/training"
                  data-course-target="sales-nav-training"
                  className="flex h-10 items-center gap-2.5 rounded-[8px] px-3 text-[13px] font-medium text-[var(--sales-sidebar-text)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
                  onClick={onCloseMobile}
                >
                  <CircleHelp
                    size={17}
                    strokeWidth={1.75}
                    className="shrink-0 text-current"
                    aria-hidden
                  />
                  Help & Support
                  <span className="sr-only"> — Training</span>
                </a>
              )}
            </SalesNavSection>
          </div>
        </nav>

        {drawer ? (
          <Link
            href="/sales/profile"
            onClick={onCloseMobile}
            className="mx-3 mb-4 flex items-center gap-3 rounded-[10px] border border-[var(--sales-sidebar-border)] px-3 py-2.5 transition-colors hover:bg-[var(--sales-sidebar-hover)]"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-1 ring-[var(--sales-sidebar-border)]"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sales-neutral-100)] text-[11px] font-semibold text-sales-text-primary ring-1 ring-[var(--sales-sidebar-border)]">
                {salesNameInitials(userName)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-sales-text-primary">
                {displaySalesName(userName)}
              </span>
              <span className="block truncate text-[11px] text-[var(--sales-sidebar-muted)]">
                {userRoleLabel}
              </span>
            </span>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-bg)] transition-[width] duration-200 ease-out layout:block",
          collapsed ? "w-[68px]" : "w-[228px]"
        )}
        data-collapsed={collapsed ? "true" : "false"}
      >
        {body({ drawer: false, collapsedMode: collapsed })}
      </aside>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 layout:hidden"
            aria-label="Close menu"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,280px)] border-r border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-bg)] shadow-[0_8px_30px_rgba(17,19,24,0.12)] layout:hidden">
            {body({ drawer: true, collapsedMode: false })}
          </aside>
        </>
      ) : null}
    </>
  );
}
