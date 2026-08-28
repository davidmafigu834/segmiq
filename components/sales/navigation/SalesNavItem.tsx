"use client";

import Link from "next/link";
import { SiWhatsapp } from "react-icons/si";
import {
  SALES_NAV_LUCIDE,
  type SalesNavIconId,
  type SalesNavItemConfig,
} from "@/lib/sales/navigation/sales-nav-config";
import { cn } from "@/lib/ui/cn";

function NavIcon({
  icon,
  active,
  collapsed,
}: {
  icon: SalesNavIconId;
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
  const Icon = SALES_NAV_LUCIDE[icon];
  return <Icon size={collapsed ? 18 : 17} strokeWidth={1.75} className={className} aria-hidden />;
}

export function SalesNavItem({
  item,
  active,
  badge,
  collapsed,
  onNavigate,
}: {
  item: SalesNavItemConfig;
  active: boolean;
  badge?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const showBadge = badge != null && badge > 0;
  const label = item.label;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? (showBadge ? `${label}, ${badge}` : label) : undefined}
      aria-current={active ? "page" : undefined}
      data-course-target={`sales-nav-${item.id}`}
      className={cn(
        "group relative flex items-center rounded-[8px] transition-[background-color,color] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "h-10 gap-2.5 px-3",
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
          <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">{label}</span>
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

export function SalesNavSection({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(collapsed ? "px-2" : "px-3")}>
      {!collapsed ? (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--sales-sidebar-muted)]">
          {label}
        </p>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      <div className={cn("flex flex-col", collapsed ? "items-center gap-1" : "gap-1")}>
        {children}
      </div>
    </div>
  );
}
