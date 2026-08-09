"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useSalesMobileChrome } from "@/components/sales/navigation/SalesMobileChromeContext";
import {
  resolveSalesNavItems,
  salesMobilePrimaryItems,
  SALES_NAV_LUCIDE,
  type SalesNavBadgeKey,
  type SalesNavIconId,
} from "@/lib/sales/navigation/sales-nav-config";
import { cn } from "@/lib/ui/cn";

function NavIcon({
  icon,
  active,
  emphasized,
}: {
  icon: SalesNavIconId;
  active: boolean;
  emphasized?: boolean;
}) {
  if (icon === "whatsapp") {
    if (emphasized) {
      return (
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-sales-brand-text shadow-[0_2px_8px_rgba(212,255,79,0.35)]",
            active ? "bg-sales-brand" : "bg-[rgba(212,255,79,0.4)]"
          )}
        >
          <SiWhatsapp size={18} color="currentColor" aria-hidden />
        </span>
      );
    }
    return (
      <SiWhatsapp
        size={18}
        color="currentColor"
        className={active ? "text-[var(--sales-sidebar-icon-active)]" : "text-sales-text-secondary"}
        aria-hidden
      />
    );
  }
  const Icon = SALES_NAV_LUCIDE[icon];
  return (
    <Icon
      size={20}
      strokeWidth={active ? 2 : 1.75}
      className={active ? "text-[var(--sales-sidebar-icon-active)]" : "text-sales-text-secondary"}
      aria-hidden
    />
  );
}

export function SalesBottomNav({
  isSolo,
  whatsappBadge,
  tasksBadge,
}: {
  isSolo: boolean;
  whatsappBadge: number;
  tasksBadge: number;
}) {
  const pathname = usePathname();
  const { setMoreOpen, moreOpen } = useSalesMobileChrome();
  const items = salesMobilePrimaryItems(resolveSalesNavItems(isSolo));
  const badges: Partial<Record<SalesNavBadgeKey, number>> = {
    whatsapp: whatsappBadge,
    tasks: tasksBadge,
  };

  return (
    <nav
      className="sales-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[40] border-t border-sales-border-subtle bg-sales-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] layout:hidden"
      aria-label="Sales mobile navigation"
      style={{ height: "calc(var(--sales-mobile-nav-height) + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto grid h-[var(--sales-mobile-nav-height)] max-w-lg grid-cols-5 items-stretch px-1">
        {items.map((item) => {
          const active = item.match(pathname);
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
          const showBadge = badge != null && badge > 0;
          const isWa = item.id === "whatsapp";
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors",
                active ? "text-sales-text-primary" : "text-sales-text-secondary"
              )}
            >
              <span
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-[10px] transition-colors",
                  !isWa && "w-11",
                  !isWa && active && "bg-[rgba(212,255,79,0.2)]"
                )}
              >
                <NavIcon icon={item.icon} active={active} emphasized={isWa} />
                {showBadge ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(212,255,79,0.95)] px-1 text-[9px] font-semibold text-[var(--sales-sidebar-badge-text)]">
                    {badge! > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate leading-none">{item.mobileLabel ?? item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={cn(
            "relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors",
            moreOpen ? "text-sales-text-primary" : "text-sales-text-secondary"
          )}
          aria-label="More"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span
            className={cn(
              "flex h-8 w-11 items-center justify-center rounded-[10px] transition-colors",
              moreOpen && "bg-[rgba(212,255,79,0.2)]"
            )}
          >
            <Ellipsis
              size={20}
              strokeWidth={moreOpen ? 2 : 1.75}
              className={moreOpen ? "text-[var(--sales-sidebar-icon-active)]" : "text-sales-text-secondary"}
              aria-hidden
            />
          </span>
          <span className="leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}
