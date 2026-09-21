"use client";

import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";
import { HubAgentLabel, WhatsAppConnectionStatus } from "./hub-chrome";

export function SalespersonHubHeader({
  connection,
  title = "WhatsApp Sales Hub",
  variant = "page",
  agentActive = false,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
}: {
  connection: SafeWhatsAppConnection | null;
  title?: string;
  variant?: "page" | "list";
  agentActive?: boolean;
  unreadNotifications?: number;
  notificationRole?: UserRole;
  userName?: string;
  avatarUrl?: string | null;
}) {
  if (variant === "list") {
    return (
      <header className="salesperson-wa-list-header shrink-0 border-b border-sales-border bg-sales-surface px-4 py-3">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-sales-text-primary">
            {title}
          </h1>
          <HubAgentLabel active={agentActive} />
        </div>
        <WhatsAppConnectionStatus connection={connection} />
      </header>
    );
  }

  const showTools = Boolean(notificationRole);

  return (
    <header className="salesperson-wa-page-header flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-sales-border bg-sales-bg px-4 py-2 sm:px-5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
            {title}
          </h1>
          <HubAgentLabel active={agentActive} />
        </div>
        <WhatsAppConnectionStatus connection={connection} />
      </div>

      {showTools ? (
        <div className="hidden shrink-0 items-center gap-2 layout:flex">
          <div className="sd-search-wrap hidden w-[min(24vw,320px)] min-w-[220px] min-[1280px]:block">
            <GlobalSearch role={notificationRole!} placeholder="Search conversations..." />
          </div>
          <NotificationBell initialUnread={unreadNotifications ?? 0} role={notificationRole!} />
          <SalesThemeToggle />
          <SalesProfileMenu
            userName={userName ?? "Sales"}
            userRoleLabel="Sales Executive"
            avatarUrl={avatarUrl}
            compact
          />
        </div>
      ) : null}
    </header>
  );
}
