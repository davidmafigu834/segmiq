"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { SalesNavSection } from "@/components/sales/navigation/SalesNavItem";
import {
  COMPANY_NAV_LUCIDE,
  COMPANY_NAV_SECTION_LABEL,
  companyNavBySection,
  getCompanyNavigation,
  getCompanyNavSectionOrder,
  type CompanyNavBadgeKey,
  type CompanyNavIconId,
  type CompanyNavItemConfig,
} from "@/lib/sales/navigation/company-nav-config";
import { displaySalesName, salesNameInitials } from "@/lib/sales/navigation/sales-nav-config";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { cn } from "@/lib/ui/cn";

function NavIcon({
  icon,
  active,
  collapsed,
}: {
  icon: CompanyNavIconId;
  active: boolean;
  collapsed?: boolean;
}) {
  const className = cn(
    "shrink-0 transition-colors duration-150",
    active ? "text-[var(--sales-sidebar-icon-active)]" : "text-current"
  );
  if (icon === "whatsapp") {
    return (
      <SiWhatsapp
        size={collapsed ? 18 : 16}
        color="currentColor"
        className={className}
        aria-hidden
      />
    );
  }
  const Icon = COMPANY_NAV_LUCIDE[icon];
  return <Icon size={collapsed ? 18 : 17} strokeWidth={1.75} className={className} aria-hidden />;
}

function CompanyNavItem({
  item,
  active,
  badge,
  collapsed,
  onNavigate,
}: {
  item: CompanyNavItemConfig;
  active: boolean;
  badge?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const showBadge = badge != null && badge > 0;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? (showBadge ? `${item.label}, ${badge}` : item.label) : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-[8px] transition-[background-color,color] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
        collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 gap-2.5 px-3",
        active
          ? collapsed
            ? "sales-nav-item-active-collapsed"
            : "sales-nav-item-active"
          : "font-medium text-[var(--sales-sidebar-text)] hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)]"
      )}
    >
      {active && !collapsed ? (
        <span className="sales-nav-rail" aria-hidden />
      ) : null}
      <NavIcon icon={item.icon} active={active} collapsed={collapsed} />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">{item.label}</span>
          {showBadge ? (
            <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--sales-sidebar-badge-bg)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--sales-sidebar-badge-text)]">
              {badge! > 99 ? "99+" : badge}
            </span>
          ) : null}
        </>
      ) : showBadge ? (
        <span
          className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--sales-sidebar-badge-bg)] px-1 text-[9px] font-semibold tabular-nums text-[var(--sales-sidebar-badge-text)]"
          aria-hidden
        >
          {badge! > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Company sidebar — same chrome density and structure as SalesSidebar
 * (wordmark header, sectioned nav, help link, profile only in mobile drawer).
 */
export function CompanySidebar({
  userName,
  userRoleLabel = "Company Manager",
  avatarUrl,
  whatsappBadge = 0,
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapsed,
}: {
  /** @deprecated kept for call-site compatibility; identity lives in page content */
  companyName?: string;
  companyLogoUrl?: string | null;
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  whatsappBadge?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const crmTheme = useCrmThemeOptional();
  const { businessType } = useCompanyWorkspace();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";
  const navigation = getCompanyNavigation(businessType);
  const sectionOrder = getCompanyNavSectionOrder(businessType);

  const badges: Partial<Record<CompanyNavBadgeKey, number>> = {
    whatsapp: whatsappBadge,
  };

  function body(opts: { drawer: boolean; collapsedMode: boolean }) {
    const { drawer, collapsedMode } = opts;
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-[var(--sales-sidebar-bg)]">
        <div
          className={cn(
            "relative flex shrink-0 items-center",
            collapsedMode ? "h-[76px] justify-center px-2" : "h-[76px] justify-between gap-2 px-5"
          )}
        >
          <Link
            href="/client/dashboard"
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
          aria-label="Company navigation"
        >
          {sectionOrder.map((sectionId, index) => {
            const items = companyNavBySection(navigation, sectionId);
            if (items.length === 0) return null;
            const isLast = index === sectionOrder.length - 1;
            return (
              <div key={sectionId} className={index === 0 ? undefined : collapsedMode ? "mt-4" : "mt-5"}>
                <SalesNavSection label={COMPANY_NAV_SECTION_LABEL[sectionId]} collapsed={collapsedMode}>
                  {items.map((item) => (
                    <CompanyNavItem
                      key={item.id}
                      item={item}
                      active={item.match(pathname)}
                      badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                      collapsed={collapsedMode}
                      onNavigate={onCloseMobile}
                    />
                  ))}
                  {isLast ? (
                    collapsedMode ? (
                      <Link
                        href="/client/settings/profile"
                        title="Help & Support"
                        aria-label="Help & Support"
                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)]"
                        onClick={onCloseMobile}
                      >
                        <CircleHelp size={17} strokeWidth={1.75} aria-hidden />
                      </Link>
                    ) : (
                      <Link
                        href="/client/settings/profile"
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
                      </Link>
                    )
                  ) : null}
                </SalesNavSection>
              </div>
            );
          })}
        </nav>

        {drawer ? (
          <Link
            href="/client/settings/profile"
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
