"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Phone,
  UserPlus,
  Zap,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";
import { greetingPart, formatDashboardDate } from "@/lib/sales/sales-dashboard-view";

export function DashboardHeader({
  firstName,
  userName,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  onOpenLog,
  onAddLead,
}: {
  firstName: string;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  onOpenLog: () => void;
  onAddLead: () => void;
}) {
  const [quickOpen, setQuickOpen] = useState(false);
  const dateLabel = formatDashboardDate();
  const greeting = `Good ${greetingPart()}, ${firstName}`;

  return (
    <div className="space-y-2 layout:space-y-1.5">
      <div className="hidden min-h-10 items-center justify-between gap-3 layout:flex">
        <p className="min-w-0 truncate text-[11px] font-medium tracking-[0.06em] text-[#98A2B3]">
          {dateLabel}
        </p>
        <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
          <div className="sd-search-wrap">
            <GlobalSearch role={notificationRole} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-10 min-w-[44px] items-center gap-1.5 rounded-[10px] bg-[#D4FF4F] px-3.5 text-[13px] font-semibold text-[#101828] transition-colors duration-150 hover:bg-[#c8f244] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/30"
                aria-expanded={quickOpen}
                aria-haspopup="menu"
                aria-label="Quick actions"
                onClick={() => setQuickOpen((v) => !v)}
              >
                <Zap size={16} strokeWidth={1.8} aria-hidden />
                <span>Quick actions</span>
                <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
              </button>
              {quickOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-20 cursor-default"
                    aria-label="Close quick actions"
                    onClick={() => setQuickOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#101828] hover:bg-[#F9FAFB]"
                      onClick={() => {
                        setQuickOpen(false);
                        onAddLead();
                      }}
                    >
                      <UserPlus size={16} strokeWidth={1.8} aria-hidden />
                      Add lead
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#101828] hover:bg-[#F9FAFB]"
                      onClick={() => {
                        setQuickOpen(false);
                        onOpenLog();
                      }}
                    >
                      <Phone size={16} strokeWidth={1.8} aria-hidden />
                      Log call
                    </button>
                    <Link
                      href="/sales/inbox"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#101828] hover:bg-[#F9FAFB]"
                      onClick={() => setQuickOpen(false)}
                    >
                      <SiWhatsapp size={16} color="#25D366" aria-hidden />
                      Open Sales Hub
                    </Link>
                    <Link
                      href="/sales/quotes"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#101828] hover:bg-[#F9FAFB]"
                      onClick={() => setQuickOpen(false)}
                    >
                      <FileText size={16} strokeWidth={1.8} aria-hidden />
                      View quotes
                    </Link>
                    <Link
                      href="/sales/calendar"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#101828] hover:bg-[#F9FAFB]"
                      onClick={() => setQuickOpen(false)}
                    >
                      <CalendarDays size={16} strokeWidth={1.8} aria-hidden />
                      View calendar
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
            <SalesProfileMenu
              userName={userName}
              userRoleLabel="Sales Executive"
              avatarUrl={avatarUrl}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[#101828] sm:text-[26px] layout:text-[30px]">
          {greeting}
        </h1>
        <p className="mt-1 text-[13px] text-[#667085] sm:mt-1.5 sm:text-[14px]">
          Here’s what’s happening with your pipeline today.
        </p>
      </div>
    </div>
  );
}
