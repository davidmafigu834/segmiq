"use client";

import Image from "next/image";
import Link from "next/link";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import type { UserRole } from "@/types";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { getCompanyNavigation } from "@/lib/sales/navigation/company-nav-config";
import { ReMobileHeaderTitle } from "@/components/real-estate/navigation/ReMobileHeaderTitle";

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
  const { isRealEstate: realEstate, businessType, solarWorkflow } = useCompanyWorkspace();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";

  const wordmark = (
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
  );

  return (
    <header className="sales-mobile-top-bar sticky top-0 z-[30] flex shrink-0 items-center justify-between gap-2 border-b border-sales-border-subtle bg-sales-surface px-4 layout:hidden">
      {realEstate ? (
        <ReMobileHeaderTitle
          entries={getCompanyNavigation(businessType, { solarWorkflow })}
          homeHref="/client/dashboard"
          home={wordmark}
          extra={[{ label: "Profile", href: "/client/settings/profile" }]}
        />
      ) : (
        wordmark
      )}

      <div className="flex shrink-0 items-center gap-1">
        <div className="sd-search-wrap">
          <GlobalSearch role={notificationRole} appearance="icon" />
        </div>
        <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
        {realEstate ? null : <SalesThemeToggle size="mobile" />}
        <SalesProfileMenu
          userName={userName}
          userRoleLabel={userRoleLabel}
          avatarUrl={avatarUrl}
          compact
          profileHref="/client/settings/profile"
          helpHref="/client/settings/profile"
          helpLabel="Help & Support"
        />
      </div>
    </header>
  );
}
