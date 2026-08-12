"use client";

import Image from "next/image";
import Link from "next/link";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import type { UserRole } from "@/types";

/** Same chrome as SalesMobileTopBar — company home + account links. */
export function CompanyMobileTopBar({
  userName,
  userRoleLabel = "Company Manager",
  avatarUrl,
  unreadNotifications,
  notificationRole,
}: {
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
}) {
  const crmTheme = useCrmThemeOptional();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";

  return (
    <header className="sales-mobile-top-bar sticky top-0 z-[30] flex shrink-0 items-center justify-between gap-2 border-b border-sales-border-subtle bg-sales-surface/95 px-4 backdrop-blur-md layout:hidden">
      <Link
        href="/client/dashboard"
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

      <div className="flex shrink-0 items-center gap-1">
        <div className="sd-search-wrap">
          <GlobalSearch role={notificationRole} />
        </div>
        <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
        <SalesThemeToggle size="mobile" />
        <SalesProfileMenu
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          compact
          profileHref="/client/account"
          helpHref="/client/account"
          helpLabel="Help & Support"
        />
      </div>
    </header>
  );
}
