"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Home, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Avatar } from "@/components/sales/ui/Avatar";
import { Tooltip } from "@/components/sales/ui/Tooltip";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { SalesNavSection } from "@/components/sales/navigation/SalesNavItem";
import {
  COMPANY_NAV_LUCIDE,
  COMPANY_NAV_SECTION_LABEL,
  companyNavBySection,
  companyNavIsActive,
  getCompanyNavigation,
  getCompanyNavSectionOrder,
  type CompanyNavBadgeKey,
  type CompanyNavIconId,
  type CompanyNavItemConfig,
} from "@/lib/sales/navigation/company-nav-config";
import { displaySalesName } from "@/lib/sales/navigation/sales-nav-config";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { ReSidebarSections } from "@/components/real-estate/navigation/ReSidebarSections";
import { RealEstateSidebarChrome } from "@/components/real-estate/navigation/RealEstateSidebarChrome";
import { isRealEstate } from "@/lib/terminology";
import { cn } from "@/lib/ui/cn";
import type { UserRole } from "@/types";
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
  studio = false,
}: {
  item: CompanyNavItemConfig;
  active: boolean;
  badge?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
  studio?: boolean;
}) {
  if (studio) {
    if (item.icon === "whatsapp") {
      return (
        <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className="re-sb-item">
          <SiWhatsapp size={18} aria-hidden />
          <span className="re-sb-label">{item.label}</span>
        </Link>
      );
    }
    const Icon = COMPANY_NAV_LUCIDE[item.icon];
    return (
      <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className="re-sb-item">
        {Icon ? <Icon size={18} strokeWidth={2} aria-hidden /> : null}
        <span className="re-sb-label">{item.label}</span>
      </Link>
    );
  }
  const showBadge = badge != null && badge > 0;
  const label = item.label;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? (showBadge ? `${label}, ${badge}` : label) : undefined}
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
      <NavIcon icon={item.icon} active={active} collapsed={collapsed} />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">{label}</span>
          {showBadge ? (
            <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-sales-sm bg-[var(--sales-sidebar-badge-bg)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--sales-sidebar-badge-text)]">
              {badge! > 99 ? "99+" : badge}
            </span>
          ) : null}
        </>
      ) : showBadge ? (
        <span
          className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-sales-sm bg-[var(--sales-sidebar-badge-bg)] px-1 text-[9px] font-semibold tabular-nums text-[var(--sales-sidebar-badge-text)]"
          aria-hidden
        >
          {badge! > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip label={label} side="right">
        {link}
      </Tooltip>
    );
  }

  return link;
}

/**
 * Company sidebar — same chrome density and structure as SalesSidebar
 * (wordmark header, sectioned nav, help link, profile only in mobile drawer).
 */
export function CompanySidebar({
  companyName,
  userName,
  userRoleLabel = "Company Manager",
  avatarUrl,
  whatsappBadge = 0,
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapsed,
  unreadNotifications = 0,
  notificationRole = "CLIENT_MANAGER",
}: {
  /** Shown as workspace context in the Real Estate sidebar only. */
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
  unreadNotifications?: number;
  notificationRole?: UserRole;
}) {
  const pathname = usePathname();
  const crmTheme = useCrmThemeOptional();
  const { businessType, solarWorkflow, userId, planBadge } = useCompanyWorkspace();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";
  const navigation = getCompanyNavigation(businessType, { solarWorkflow });
  const realEstate = isRealEstate(businessType);
  const sectionOrder = getCompanyNavSectionOrder(businessType, { solarWorkflow });
  const [find, setFind] = useState("");
  const findQuery = find.trim().toLowerCase();
  const shownNavigation = realEstate && findQuery
    ? navigation.filter((item) => item.label.toLowerCase().includes(findQuery))
    : navigation;

  const badges: Partial<Record<CompanyNavBadgeKey, number>> = {
    whatsapp: whatsappBadge,
  };

  function body(opts: { drawer: boolean; collapsedMode: boolean }) {
    const { drawer, collapsedMode } = opts;
    if (realEstate) {
      const groups = sectionOrder
        .map((sectionId) => ({
          id: sectionId,
          label: COMPANY_NAV_SECTION_LABEL[sectionId],
          items: companyNavBySection(shownNavigation, sectionId),
        }))
        .filter((group) => group.items.length > 0);
      return (
        <RealEstateSidebarChrome
          name={companyName?.trim() || userName}
          personName={userName}
          userId={userId}
          planBadge={planBadge}
          role={userRoleLabel}
          homeHref="/client/dashboard"
          helpHref="/client/settings/profile"
          notificationRole={notificationRole}
          unread={unreadNotifications}
          attention={whatsappBadge}
          drawer={drawer}
          onClose={onCloseMobile}
          query={find}
          onQuery={setFind}
        >
          {groups.length === 0 ? <p className="re-sb-soon-block">No matches.</p> : (
            <ReSidebarSections
              appearance="studio"
              groups={groups}
              isActive={(item) => companyNavIsActive(item, pathname)}
              collapsedMode={false}
              storageKey={drawer ? "segmiq-re-nav-groups-company-drawer" : "segmiq-re-nav-groups-company"}
              ariaLabel="Company navigation"
              renderItem={(item) => (
                <CompanyNavItem
                  key={item.id}
                  item={item}
                  active={companyNavIsActive(item, pathname)}
                  studio
                  onNavigate={onCloseMobile}
                />
              )}
            />
          )}
        </RealEstateSidebarChrome>
      );
    }
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-[var(--sales-sidebar-bg)]">
        <div
          className={cn(
            "relative flex shrink-0",
            collapsedMode
              ? "flex-col items-center gap-1 px-2 pb-2 pt-3"
              : "h-[72px] items-center justify-between gap-2 px-5"
          )}
        >
          {realEstate && !collapsedMode ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sales-brand text-sales-brand-text" aria-hidden>
                <Home size={14} strokeWidth={2} />
              </span>
              <span className="truncate text-[14px] font-medium text-[var(--sales-sidebar-text)]">{companyName?.trim() || userName}</span>
            </div>
          ) : (
          <Link
            href="/client/dashboard"
            onClick={onCloseMobile}
            className="flex min-w-0 items-center focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
          >
            {collapsedMode ? (
              realEstate ? (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-sales-brand text-sales-brand-text" aria-hidden>
                  <Home size={14} strokeWidth={2} />
                </span>
              ) : (
              <Image
                src="/brand/segmiq-q.png"
                alt="SegmiQ"
                width={28}
                height={28}
                priority
                className="h-7 w-7 object-contain"
              />
              )
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
          )}

          {drawer ? (
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
              aria-label="Close menu"
              onClick={onCloseMobile}
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          ) : onToggleCollapsed && !collapsedMode ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeftClose size={16} strokeWidth={1.8} />
            </button>
          ) : onToggleCollapsed && collapsedMode ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeftOpen size={14} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        {realEstate ? (
          <>
            {collapsedMode ? null : (
              <label className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-[8px] border border-[var(--sales-sidebar-border)] px-2 text-[var(--sales-sidebar-muted)]">
                <Search size={16} strokeWidth={1.75} aria-hidden />
                <input
                  value={find}
                  onChange={(event) => setFind(event.target.value)}
                  placeholder="Find"
                  aria-label="Find a screen"
                  className="min-w-0 flex-1 bg-transparent text-[14px] font-normal text-[var(--sales-sidebar-text)] outline-none placeholder:text-[var(--sales-sidebar-muted)]"
                />
              </label>
            )}
            <ReSidebarSections
              groups={sectionOrder.map((sectionId) => ({
                id: sectionId,
                label: COMPANY_NAV_SECTION_LABEL[sectionId],
                items: companyNavBySection(shownNavigation, sectionId),
              }))}
              isActive={(item) => item.match(pathname)}
              collapsedMode={collapsedMode}
              storageKey={drawer ? "segmiq-re-nav-groups-company-drawer" : "segmiq-re-nav-groups-company"}
              ariaLabel="Company navigation"
              renderItem={(item) => (
                <CompanyNavItem
                  key={item.id}
                  item={item}
                  active={item.match(pathname)}
                  badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                  collapsed={collapsedMode}
                  onNavigate={onCloseMobile}
                />
              )}
            />
            <div className={cn("shrink-0 border-t border-[var(--sales-sidebar-border)] py-2", collapsedMode ? "px-2" : "px-3")}>
              {collapsedMode ? (
                <Tooltip label="Help & Support" side="right">
                  <Link
                    href="/client/settings/profile"
                    aria-label="Help & Support"
                    className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
                    onClick={onCloseMobile}
                  >
                    <CircleHelp size={17} strokeWidth={1.75} aria-hidden />
                  </Link>
                </Tooltip>
              ) : (
                <Link
                  href="/client/settings/profile"
                  className="flex h-10 items-center gap-2.5 rounded-[8px] px-3 text-[13px] font-medium text-[var(--sales-sidebar-text)] transition-colors duration-150 hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
                  onClick={onCloseMobile}
                >
                  <CircleHelp size={17} strokeWidth={1.75} className="shrink-0 text-current" aria-hidden />
                  Help & Support
                </Link>
              )}
            </div>
          </>
        ) : (
        <nav
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-3"
          aria-label="Company navigation"
        >
          {sectionOrder.map((sectionId, index) => {
            const items = companyNavBySection(navigation, sectionId);
            if (items.length === 0) return null;
            const isLast = index === sectionOrder.length - 1;
            return (
              <div key={sectionId} className={index === 0 ? undefined : collapsedMode ? "mt-3" : "mt-3.5"}>
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
        )}

        {drawer ? (
          <Link
            href="/client/settings/profile"
            onClick={onCloseMobile}
            className="mx-3 mb-4 flex items-center gap-3 rounded-[10px] border border-[var(--sales-sidebar-border)] px-3 py-2.5 transition-colors hover:bg-[var(--sales-sidebar-hover)]"
          >
            <Avatar name={displaySalesName(userName)} src={avatarUrl} size="sm" alt="" />
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
          realEstate && "re-sb-frame",
          collapsed && !realEstate ? "w-[68px]" : realEstate ? "w-[272px]" : "w-[228px]"
        )}
        data-collapsed={collapsed ? "true" : "false"}
      >
        {body({ drawer: false, collapsedMode: realEstate ? false : collapsed })}
      </aside>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 layout:hidden"
            aria-label="Close menu"
            onClick={onCloseMobile}
          />
          <aside className={cn("fixed inset-y-0 left-0 z-50 w-[min(88vw,280px)] border-r border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-bg)] shadow-[0_8px_30px_rgba(17,19,24,0.12)] layout:hidden", realEstate && "re-sb-frame w-[272px]")}>
            {body({ drawer: true, collapsedMode: false })}
          </aside>
        </>
      ) : null}
    </>
  );
}
