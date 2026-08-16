"use client";

import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";

export function CompanySettingsHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="hidden min-h-10 items-center justify-between gap-3 layout:flex">
        <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          SETTINGS
        </p>
        <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
          <div className="sd-search-wrap min-w-0 shrink">
            <GlobalSearch role={notificationRole} />
          </div>
          <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
          <SalesThemeToggle />
          <SalesProfileMenu
            userName={userName}
            userRoleLabel="Company Manager"
            avatarUrl={avatarUrl}
            profileHref="/client/settings/profile"
            helpHref="/client/settings/profile"
            helpLabel="Help & Support"
          />
        </div>
      </div>
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[26px] layout:text-[28px]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary sm:text-[14px]">
          Manage your company account, preferences and system configuration.
        </p>
      </div>
    </div>
  );
}
