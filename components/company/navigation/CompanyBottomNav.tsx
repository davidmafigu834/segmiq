"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Ellipsis, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  COMPANY_NAV_LUCIDE,
  COMPANY_NAV_SECTION_LABEL,
  companyMobileMoreItems,
  companyMobilePrimaryItems,
  companyNavBySection,
  getCompanyNavigation,
  getCompanyNavSectionOrder,
  type CompanyNavBadgeKey,
  type CompanyNavIconId,
} from "@/lib/sales/navigation/company-nav-config";
import { ReMobileMenuSheet } from "@/components/real-estate/navigation/ReMobileMenuSheet";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { isRealEstate } from "@/lib/terminology";
import { cn } from "@/lib/ui/cn";

function NavIcon({
  icon,
  active,
  emphasized,
}: {
  icon: CompanyNavIconId;
  active: boolean;
  emphasized?: boolean;
}) {
  if (icon === "whatsapp") {
    if (emphasized) {
      return (
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-sales-md text-sales-brand-text",
            active ? "bg-sales-brand" : "bg-sales-brand-soft text-[var(--sales-sidebar-icon-active)]"
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
  const Icon = COMPANY_NAV_LUCIDE[icon];
  return (
    <Icon
      size={20}
      strokeWidth={active ? 2 : 1.75}
      className={active ? "text-[var(--sales-sidebar-icon-active)]" : "text-sales-text-secondary"}
      aria-hidden
    />
  );
}

function MenuIcon({ icon }: { icon: CompanyNavIconId }) {
  if (icon === "whatsapp") return <SiWhatsapp size={18} color="currentColor" aria-hidden />;
  const Icon = COMPANY_NAV_LUCIDE[icon];
  return <Icon size={18} strokeWidth={1.75} aria-hidden />;
}

export function CompanyBottomNav({ whatsappBadge = 0 }: { whatsappBadge?: number }) {
  const pathname = usePathname();
  const { businessType, solarWorkflow } = useCompanyWorkspace();
  const navigation = getCompanyNavigation(businessType, { solarWorkflow });
  const [moreOpen, setMoreOpen] = useState(false);
  const items = companyMobilePrimaryItems(navigation);
  const moreItems = companyMobileMoreItems(navigation);
  const realEstate = isRealEstate(businessType);
  const badges: Partial<Record<CompanyNavBadgeKey, number>> = {
    whatsapp: whatsappBadge,
  };

  return (
    <>
      <nav
        className="sales-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[40] border-t border-sales-border-subtle bg-sales-surface pb-[env(safe-area-inset-bottom,0px)] layout:hidden"
        aria-label="Company mobile navigation"
        style={{ height: "calc(var(--sales-mobile-nav-height) + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto grid h-[var(--sales-mobile-nav-height)] max-w-lg grid-cols-5 items-stretch px-1">
          {items.map((item) => {
            const active = item.match(pathname);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            const showBadge = badge != null && badge > 0;
            const isWa = item.id === "whatsapp" && !realEstate;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 font-medium transition-colors",
                  realEstate ? "gap-1 text-[11px]" : "text-[10px]",
                  active ? "text-sales-text-primary" : "text-sales-text-secondary"
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-[10px] transition-colors",
                    !isWa && "w-11",
                    !isWa && active && "bg-[var(--sales-sidebar-active)]"
                  )}
                >
                  <NavIcon icon={item.icon} active={active} emphasized={isWa} />
                  {showBadge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-sales-sm bg-sales-brand px-1 text-[9px] font-semibold text-sales-brand-text">
                      {badge! > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate leading-none">
                  {item.mobileLabel ?? item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            className={cn(
              "relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 font-medium transition-colors",
              realEstate ? "gap-1 text-[11px]" : "text-[10px]",
              moreOpen ? "text-sales-text-primary" : "text-sales-text-secondary"
            )}
            aria-label={realEstate ? "Menu" : "More"}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <span
              className={cn(
                "flex h-8 w-11 items-center justify-center rounded-[10px] transition-colors",
                moreOpen && "bg-[var(--sales-sidebar-active)]"
              )}
            >
              <Ellipsis
                size={20}
                strokeWidth={moreOpen ? 2 : 1.75}
                className={
                  moreOpen ? "text-[var(--sales-sidebar-icon-active)]" : "text-sales-text-secondary"
                }
                aria-hidden
              />
            </span>
            <span className="leading-none">{realEstate ? "Menu" : "More"}</span>
          </button>
        </div>
      </nav>

      {moreOpen && realEstate ? (
        <ReMobileMenuSheet
          onClose={() => setMoreOpen(false)}
          description="Property, buyer and agency work."
          groups={[
            ...getCompanyNavSectionOrder(businessType)
              .filter((id) => id !== "main")
              .map((id) => ({
                id,
                label: COMPANY_NAV_SECTION_LABEL[id],
                items: companyNavBySection(navigation, id).map((item) => ({
                  id: item.id,
                  label: item.label,
                  href: item.href,
                  icon: <MenuIcon icon={item.icon} />,
                  active: item.match(pathname),
                })),
              }))
              .map((group) =>
                group.id === "system"
                  ? {
                      ...group,
                      items: [
                        ...group.items,
                        {
                          id: "help",
                          label: "Help & Support",
                          href: "/client/settings/profile",
                          icon: <CircleHelp size={18} strokeWidth={1.75} aria-hidden />,
                          active: false,
                        },
                      ],
                    }
                  : group
              ),
          ]}
        />
      ) : null}

      {moreOpen && !realEstate ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] bg-black/40 layout:hidden"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[50] rounded-t-[16px] border border-sales-border bg-sales-surface pb-[env(safe-area-inset-bottom,0px)] shadow-sales-popover layout:hidden">
            <div className="flex items-center justify-between border-b border-sales-border-subtle px-4 py-3">
              <p className="text-[14px] font-semibold text-sales-text-primary">More</p>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto py-2">
              {moreItems.map((item) => {
                const Icon =
                  item.icon === "whatsapp" ? null : COMPANY_NAV_LUCIDE[item.icon];
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3 text-[14px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                      onClick={() => setMoreOpen(false)}
                    >
                      {item.icon === "whatsapp" ? (
                        <SiWhatsapp size={18} className="text-sales-whatsapp" aria-hidden />
                      ) : Icon ? (
                        <Icon size={18} strokeWidth={1.75} className="text-sales-text-secondary" />
                      ) : null}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
