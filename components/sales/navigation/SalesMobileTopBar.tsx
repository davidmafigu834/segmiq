"use client";

import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import type { UserRole } from "@/types";
import { DemoWorkspaceChip } from "@/components/demo/DemoWorkspaceChip";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { resolveSalesNavItems } from "@/lib/sales/navigation/sales-nav-config";
import { ReMobileHeaderTitle } from "@/components/real-estate/navigation/ReMobileHeaderTitle";

export function SalesMobileTopBar({
  isSolo,
  userName,
  userRoleLabel = "Sales Executive",
  avatarUrl,
  unreadNotifications,
  notificationRole,
  demoGuest = false,
  onOpenMenu,
}: {
  isSolo: boolean;
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  demoGuest?: boolean;
  onOpenMenu?: () => void;
}) {
  const homeHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";
  const crmTheme = useCrmThemeOptional();
  const { isRealEstate: realEstate, businessType, solarWorkflow } = useCompanyWorkspace();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";

  const wordmark = (
    <Link
      href={homeHref}
      className="flex min-w-0 items-center focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
    >
      <Image
        src={wordmarkSrc}
        alt="SegmiQ"
        width={112}
        height={26}
        priority
        className="h-[26px] w-auto max-w-[112px] object-contain object-left"
      />
    </Link>
  );

  if (realEstate) {
    return (
      <header className="sales-mobile-top-bar sticky top-0 z-[30] flex h-[52px] shrink-0 items-center gap-2 border-b border-sales-border-subtle bg-[var(--sales-sidebar-bg)] px-3 layout:hidden">
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] hover:bg-[var(--sales-sidebar-hover)]"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sales-brand text-sales-brand-text" aria-hidden>
            <Home size={14} strokeWidth={2} />
          </span>
        </button>
        <div className="min-w-0 flex-1 text-[14px] font-medium text-sales-text-primary">
          <ReMobileHeaderTitle
            entries={resolveSalesNavItems(isSolo, businessType, { solarWorkflow })}
            homeHref={homeHref}
            home={<span className="truncate">Today</span>}
            extra={[
              { label: "My profile", href: "/sales/profile" },
              { label: "Help & Support", href: "/sales/training" },
            ]}
          />
        </div>
        {demoGuest ? <DemoWorkspaceChip /> : <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />}
      </header>
    );
  }

  return (
    <header className="sales-mobile-top-bar sticky top-0 z-[30] shrink-0 items-center justify-between gap-2 border-b border-sales-border-subtle bg-sales-surface px-4 layout:hidden">
      {realEstate ? (
        <ReMobileHeaderTitle
          entries={resolveSalesNavItems(isSolo, businessType, { solarWorkflow })}
          homeHref={homeHref}
          home={wordmark}
          extra={[
            { label: "My profile", href: "/sales/profile" },
            { label: "Help & Support", href: "/sales/training" },
          ]}
        />
      ) : (
        wordmark
      )}

      <div className="flex min-w-0 shrink items-center gap-1">
        {demoGuest ? <DemoWorkspaceChip /> : null}
        {demoGuest ? null : (
          <div className="sd-search-wrap">
            <GlobalSearch role={notificationRole} appearance="icon" />
          </div>
        )}
        {demoGuest ? null : <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />}
        {realEstate ? null : <SalesThemeToggle size="mobile" />}
        <SalesProfileMenu
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          compact
        />
      </div>
    </header>
  );
}
