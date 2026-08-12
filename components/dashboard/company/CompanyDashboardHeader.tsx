"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, UserPlus, Users, Zap } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesPageHeader } from "@/components/sales/shell/SalesAppShell";
import { Button } from "@/components/sales/ui/Button";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import { greetingPart } from "@/lib/sales/sales-dashboard-view";
import type { UserRole } from "@/types";

export function CompanyDashboardHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  canAddLead,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  canAddLead: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct");
  const firstName = userName.trim().split(/\s+/)[0] || "there";
  const greeting = `Good ${greetingPart()}, ${firstName}`;

  return (
    <>
      <SalesPageHeader
        breadcrumb="Company / Dashboard"
        title={greeting}
        description="Overview of your sales operation and team performance."
        actions={
          <>
            <div className="sd-search-wrap min-w-0 shrink">
              <GlobalSearch role={notificationRole} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
              <SalesThemeToggle />
              <div className="relative">
                <Button
                  variant="primary"
                  size="md"
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-label="Quick actions"
                  onClick={() => setOpen((v) => !v)}
                  leftIcon={<Zap size={16} strokeWidth={1.8} />}
                  rightIcon={<ChevronDown size={14} strokeWidth={1.8} />}
                >
                  Quick actions
                </Button>
                {open ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-20 cursor-default"
                      aria-label="Close quick actions"
                      onClick={() => setOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-[40] mt-2 w-56 overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
                    >
                      {canAddLead ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                          onClick={() => {
                            setOpen(false);
                            openAddHubSheet();
                          }}
                        >
                          <UserPlus size={15} strokeWidth={1.8} aria-hidden />
                          Add Lead
                        </button>
                      ) : null}
                      <Link
                        href="/client/team"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                        onClick={() => setOpen(false)}
                      >
                        <Users size={15} strokeWidth={1.8} aria-hidden />
                        Add salesperson
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
              <SalesProfileMenu
                userName={userName}
                userRoleLabel="Company Manager"
                avatarUrl={avatarUrl}
                profileHref="/client/account"
                helpHref="/client/account"
                helpLabel="Help & Support"
              />
            </div>
          </>
        }
      />
      {hubSheet}
    </>
  );
}
