"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import {
  COMPANY_NAV_LUCIDE,
  COMPANY_NAVIGATION,
  companyNameInitials,
  type CompanyNavBadgeKey,
  type CompanyNavIconId,
  type CompanyNavItemConfig,
} from "@/lib/sales/navigation/company-nav-config";
import { displaySalesName, salesNameInitials } from "@/lib/sales/navigation/sales-nav-config";
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
    active ? "text-[var(--sales-sidebar-icon-active)]" : "text-[var(--sales-sidebar-icon)]"
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
          : collapsed
            ? "text-[var(--sales-sidebar-text)] hover:bg-[var(--sales-sidebar-hover)]"
            : "font-medium text-[var(--sales-sidebar-text)] hover:bg-[var(--sales-sidebar-hover)] hover:text-[var(--sales-sidebar-text-hover)]"
      )}
    >
      {active && !collapsed ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--sales-sidebar-active-indicator)]"
          aria-hidden
        />
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

export function CompanySidebar({
  companyName,
  companyLogoUrl,
  userName,
  userRoleLabel = "Company Manager",
  avatarUrl,
  whatsappBadge = 0,
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapsed,
}: {
  companyName: string;
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
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";

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
            collapsedMode ? "h-[68px] justify-center px-2" : "h-[72px] justify-between gap-2 px-5"
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
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)]"
              aria-label="Close menu"
              onClick={onCloseMobile}
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          ) : onToggleCollapsed && !collapsedMode ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)]"
              aria-label="Collapse sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeftClose size={16} strokeWidth={1.8} />
            </button>
          ) : null}

          {onToggleCollapsed && collapsedMode && !drawer ? (
            <button
              type="button"
              className="absolute bottom-1 left-1/2 inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)]"
              aria-label="Expand sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeftOpen size={14} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        {!collapsedMode ? (
          <div className="mx-3 mb-3 rounded-[12px] border border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-hover)] px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              {companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--sales-sidebar-border)]"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-brand text-[11px] font-semibold text-sales-brand-fg">
                  {companyNameInitials(companyName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                  {companyName}
                </p>
                <p className="truncate text-[11px] text-[var(--sales-sidebar-muted)]">
                  Company account
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <nav
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 pb-3"
          aria-label="Company navigation"
        >
          <div className="space-y-0.5">
            {COMPANY_NAVIGATION.map((item) => (
              <CompanyNavItem
                key={item.id}
                item={item}
                active={item.match(pathname)}
                badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                collapsed={collapsedMode}
                onNavigate={onCloseMobile}
              />
            ))}
          </div>

          <div className={cn("mt-auto pt-4", collapsedMode ? "px-0" : "px-1")}>
            {collapsedMode ? (
              <Link
                href="/client/account"
                title="Help & Support"
                aria-label="Help & Support"
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)]"
                onClick={onCloseMobile}
              >
                <CircleHelp size={17} strokeWidth={1.75} aria-hidden />
              </Link>
            ) : (
              <Link
                href="/client/account"
                className="flex h-10 items-center gap-2.5 rounded-[8px] px-3 text-[13px] font-medium text-[var(--sales-sidebar-text)] hover:bg-[var(--sales-sidebar-hover)]"
                onClick={onCloseMobile}
              >
                <CircleHelp
                  size={17}
                  strokeWidth={1.75}
                  className="shrink-0 text-[var(--sales-sidebar-icon)]"
                  aria-hidden
                />
                Help & Support
              </Link>
            )}
          </div>
        </nav>

        <Link
          href="/client/account"
          onClick={onCloseMobile}
          className={cn(
            "mb-4 flex items-center gap-3 rounded-[10px] border border-[var(--sales-sidebar-border)] transition-colors hover:bg-[var(--sales-sidebar-hover)]",
            collapsedMode ? "mx-2 justify-center px-2 py-2" : "mx-3 px-3 py-2.5"
          )}
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
          {!collapsedMode ? (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-sales-text-primary">
                {displaySalesName(userName)}
              </span>
              <span className="block truncate text-[11px] text-[var(--sales-sidebar-muted)]">
                {userRoleLabel}
              </span>
            </span>
          ) : null}
        </Link>
      </div>
    );
  }

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-bg)] transition-[width] duration-200 ease-out layout:block",
          collapsed ? "w-[68px]" : "w-[240px]"
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
