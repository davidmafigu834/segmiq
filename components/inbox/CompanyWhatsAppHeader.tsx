"use client";

import Link from "next/link";
import { ChevronDown, Send } from "lucide-react";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";

export function CompanyWhatsAppHeader({
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
    <header className="flex shrink-0 items-start justify-between gap-5 px-4 pb-4 pt-4 sm:px-6 layout:px-7 layout:pb-4 layout:pt-5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted">
          WhatsApp Sales Hub
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[24px] font-semibold leading-tight tracking-[-0.035em] text-sales-text-primary layout:text-[28px]">
            WhatsApp Sales Hub
          </h1>
          <span className="inline-flex shrink-0 rounded-full border border-[rgba(37,211,102,0.24)] bg-[rgba(37,211,102,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[#168A42]">
            Company
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-sales-text-secondary sm:text-[13px]">
          Manage all WhatsApp conversations, Leads and team responses in one place.
        </p>
      </div>

      <div className="hidden min-w-0 shrink flex-col items-end gap-3 layout:flex">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="sd-search-wrap w-[min(30vw,430px)] min-w-[260px]">
            <GlobalSearch
              role={notificationRole}
              placeholder="Search leads, deals, customers, activities..."
            />
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
        <Link
          href="/client/marketing/campaigns/new"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] bg-sales-brand px-4 text-[12px] font-semibold text-sales-brand-text transition-colors hover:brightness-[0.97] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
          title="Create an approved-template WhatsApp campaign"
        >
          <Send size={15} strokeWidth={1.8} aria-hidden />
          Broadcast Message
          <ChevronDown size={13} strokeWidth={1.8} aria-hidden />
        </Link>
      </div>
    </header>
  );
}
