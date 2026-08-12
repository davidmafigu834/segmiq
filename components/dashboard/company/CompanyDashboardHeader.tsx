"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, UserPlus, Users, Zap } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesPageHeader } from "@/components/sales/shell/SalesAppShell";
import { Button } from "@/components/sales/ui/Button";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import type { UserRole } from "@/types";

export function CompanyDashboardHeader({
  unreadNotifications,
  notificationRole,
  canAddLead,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  canAddLead: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct");

  return (
    <>
      <SalesPageHeader
        breadcrumb="Company / Dashboard"
        title="Company dashboard"
        description="Overview of your sales operation and team performance."
        actions={
          <>
            <div className="sd-search-wrap hidden min-w-0 shrink layout:inline-flex">
              <GlobalSearch role={notificationRole} />
            </div>
            <div className="hidden shrink-0 items-center gap-1.5 layout:flex">
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
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Close quick actions"
                      onClick={() => setOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface-raised py-1 shadow-lg"
                    >
                      {canAddLead ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
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
                        className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                        onClick={() => setOpen(false)}
                      >
                        <Users size={15} strokeWidth={1.8} aria-hidden />
                        Add salesperson
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        }
      />
      {hubSheet}
    </>
  );
}
