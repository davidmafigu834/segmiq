"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import { SalesHeaderQuickActions } from "@/components/sales/navigation/SalesHeaderQuickActions";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import { greetingPart } from "@/lib/sales/sales-dashboard-view";
import { cn } from "@/lib/ui/cn";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
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
  hideTitleBlock = false,
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
  /** Product record workspaces put identity inside the content card. */
  hideTitleBlock?: boolean;
}) {
  const { terminology } = useCompanyWorkspace();
  const router = useRouter();
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct");
  const firstName = userName.trim().split(/\s+/)[0] || "there";
  const greeting = title ?? `Good ${greetingPart()}, ${firstName}`;

  const quickActionItems = [
    canAddLead
      ? {
          key: "add-lead",
          label: terminology.actions.addLead,
          icon: <UserPlus size={16} strokeWidth={1.8} aria-hidden />,
          onSelect: openAddHubSheet,
        }
      : null,
    {
      key: "add-team",
      label: `Add ${terminology.salesperson.singular.toLowerCase()}`,
      icon: <Users size={16} strokeWidth={1.8} aria-hidden />,
      onSelect: () => router.push("/client/team?invite=1"),
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

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
              <SalesHeaderQuickActions items={quickActionItems} />
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

        {hideTitleBlock ? null : (
        <div className="min-w-0 layout:mt-3.5 layout:border-t layout:border-sales-border-subtle layout:pb-1 layout:pt-5">
          <div className="flex min-w-0 flex-col gap-3 layout:flex-row layout:items-start layout:justify-between">
            <div className="min-w-0">
              <h1 className="dashboard-greeting text-[22px] leading-tight text-sales-text-primary sm:text-[24px] layout:text-[26px]">
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
        )}
      </header>
      {hubSheet}
    </>
  );
}
