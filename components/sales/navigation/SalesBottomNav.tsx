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
            "flex h-11 w-11 items-center justify-center rounded-full",
            active ? "bg-sales-brand" : "bg-[rgba(212,255,79,0.35)]"
          )}
        >
          <SiWhatsapp size={20} color="#101828" aria-hidden />
        </span>
      );
    }
    return (
      <SiWhatsapp
        size={18}
        color="currentColor"
        className={active ? "text-[#4E6400]" : "text-sales-text-secondary"}
        aria-hidden
      />
    );
  }
  const Icon = SALES_NAV_LUCIDE[icon];
  return (
    <Icon
      size={20}
      strokeWidth={1.75}
      className={active ? "text-[#4E6400]" : "text-sales-text-secondary"}
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
      className="sales-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[40] border-t border-sales-border bg-sales-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(16,24,40,0.05)] layout:hidden"
      aria-label="Sales mobile navigation"
      style={{ height: "calc(var(--sales-mobile-nav-height) + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex h-[var(--sales-mobile-nav-height)] max-w-lg items-stretch justify-between px-1">
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
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                active ? "text-[#101828]" : "text-sales-text-secondary"
              )}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center rounded-[10px] transition-colors",
                  !isWa && active && "bg-[rgba(212,255,79,0.18)] px-3 py-1"
                )}
              >
                <NavIcon icon={item.icon} active={active} emphasized={isWa} />
                {showBadge ? (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(212,255,79,0.9)] px-1 text-[9px] font-semibold text-[#4E6500]">
                    {badge! > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.mobileLabel ?? item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={cn(
            "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
            moreOpen ? "text-[#101828]" : "text-sales-text-secondary"
          )}
          aria-label="More"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-[10px] px-3 py-1",
              moreOpen && "bg-[rgba(212,255,79,0.18)]"
            )}
          >
            <Ellipsis
              size={20}
              strokeWidth={1.75}
              className={moreOpen ? "text-[#4E6400]" : "text-sales-text-secondary"}
              aria-hidden
            />
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
