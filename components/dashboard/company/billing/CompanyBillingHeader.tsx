"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";

export function CompanyBillingHeader({
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
          BILLING
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
            profileHref="/client/account"
            helpHref="/client/account"
            helpLabel="Help & Support"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 layout:flex-row layout:items-start layout:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[26px] layout:text-[28px]">
            Billing
          </h1>
          <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary sm:text-[14px]">
            Manage your subscription, payment methods and billing history.
          </p>
        </div>
        <Link
          href="/client/account"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
        >
          Need help?
          <span className="inline-flex items-center gap-1 text-sales-text-primary">
            Billing help center
            <ExternalLink size={13} strokeWidth={1.8} aria-hidden />
          </span>
        </Link>
      </div>
    </div>
  );
}
