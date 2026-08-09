"use client";

import Image from "next/image";
import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";

export function SalesMobileTopBar({
  isSolo,
  userName,
  userRoleLabel = "Sales Executive",
  avatarUrl,
  unreadNotifications,
  notificationRole,
}: {
  isSolo: boolean;
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
}) {
  const homeHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";

  return (
    <header className="sales-mobile-top-bar sticky top-0 z-[30] shrink-0 items-center justify-between gap-2 border-b border-sales-border-subtle bg-sales-surface px-4 layout:hidden">
      <Link
        href={homeHref}
        className="flex min-w-0 items-center focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
      >
        <Image
          src="/segmiq-wordmark-black.png"
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
