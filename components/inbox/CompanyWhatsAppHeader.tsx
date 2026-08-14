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
    <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-4 px-4 py-2.5 sm:px-5 layout:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted">
          WhatsApp Sales Hub
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[21px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary layout:text-[23px]">
            WhatsApp Sales Hub
          </h1>
          <span className="inline-flex shrink-0 rounded-full border border-[rgba(37,211,102,0.24)] bg-[rgba(37,211,102,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[#168A42]">
            Company
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-snug text-sales-text-secondary sm:text-[12px]">
          Manage conversations, customer context and team responses in one place.
        </p>
      </div>

      <div className="hidden min-w-0 shrink items-center gap-1.5 layout:flex">
          <div className="sd-search-wrap hidden w-[min(28vw,390px)] min-w-[250px] min-[1280px]:block">
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
        <Link
          href="/client/marketing/campaigns/new"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-sales-brand px-3 text-[11px] font-semibold text-sales-brand-text transition-colors hover:brightness-[0.97] focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
          title="Create an approved-template WhatsApp campaign"
        >
          <Send size={15} strokeWidth={1.8} aria-hidden />
          Broadcast Message
          <ChevronDown size={12} strokeWidth={1.8} aria-hidden />
        </Link>
      </div>
    </header>
  );
}
