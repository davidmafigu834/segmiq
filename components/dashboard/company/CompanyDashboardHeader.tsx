"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, UserPlus, Users, Zap } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { Button } from "@/components/sales/ui/Button";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import { greetingPart } from "@/lib/sales/sales-dashboard-view";
import { cn } from "@/lib/ui/cn";
import type { UserRole } from "@/types";

function BreadcrumbTrail({ value }: { value: string }) {
  const parts = value.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[12px] leading-none text-sales-text-muted">
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          return (
            <li key={`${part}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight size={12} strokeWidth={1.8} className="shrink-0 opacity-45" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "truncate",
                  last ? "font-medium text-sales-text-secondary" : "font-medium"
                )}
              >
                {part}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CompanyDashboardHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  canAddLead,
  breadcrumb = "Company / Dashboard",
  title,
  description = "Company health, team performance, and where to intervene.",
  primaryAction,
  titleActions,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  canAddLead: boolean;
  breadcrumb?: string;
  title?: string;
  description?: string;
  /** Replaces the default Quick actions control. Pass `null` to hide it. */
  primaryAction?: ReactNode;
  /** Filters, dates, or help links shown beside the page title. */
  titleActions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct");
  const firstName = userName.trim().split(/\s+/)[0] || "there";
  const greeting = title ?? `Good ${greetingPart()}, ${firstName}`;

  return (
    <>
      <header className="min-w-0">
        <div className="hidden items-center gap-3 layout:flex">
          <BreadcrumbTrail value={breadcrumb} />
          <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-2">
            <div className="sd-search-wrap min-w-0">
              <GlobalSearch role={notificationRole} />
            </div>

            <div className="flex items-center gap-1">
              <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
              <SalesThemeToggle />
            </div>

            {primaryAction !== undefined ? (
              primaryAction
            ) : (
              <div className="relative">
                <Button
                  variant="primary"
                  size="md"
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-label="Quick actions"
                  onClick={() => setOpen((v) => !v)}
                  leftIcon={<Zap size={15} strokeWidth={1.8} />}
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
                      className="absolute right-0 z-[40] mt-2 w-56 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
                    >
                      {canAddLead ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                          onClick={() => {
                            setOpen(false);
                            openAddHubSheet();
                          }}
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-sales-surface-subtle text-sales-text-secondary">
                            <UserPlus size={14} strokeWidth={1.8} aria-hidden />
                          </span>
                          Add Lead
                        </button>
                      ) : null}
                      <Link
                        href="/client/team?invite=1"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                        onClick={() => setOpen(false)}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-sales-surface-subtle text-sales-text-secondary">
                          <Users size={14} strokeWidth={1.8} aria-hidden />
                        </span>
                        Add salesperson
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            <SalesProfileMenu
              userName={userName}
              userRoleLabel="Company Manager"
              avatarUrl={avatarUrl}
              profileHref="/client/account"
              helpHref="/client/account"
              helpLabel="Help & Support"
              compact
            />
          </div>
        </div>

        <div className="min-w-0 layout:mt-3.5 layout:border-t layout:border-sales-border-subtle layout:pt-4">
          <div className="flex min-w-0 flex-col gap-3 layout:flex-row layout:items-start layout:justify-between">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[24px] layout:text-[26px]">
                {greeting}
              </h1>
              {description ? (
                <p className="mt-1 max-w-[42rem] text-[13px] leading-snug text-sales-text-secondary sm:mt-1.5 sm:text-[14px]">
                  {description}
                </p>
              ) : null}
            </div>
            {titleActions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 layout:justify-end">
                {titleActions}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {hubSheet}
    </>
  );
}
