"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";
import { HubAgentLabel, WhatsAppConnectionStatus } from "./hub-chrome";

function ConnectionCluster({
  connection,
  compact = false,
}: {
  connection: SafeWhatsAppConnection | null;
  compact?: boolean;
}) {
  const showBroadcast = connection?.connected === true && connection?.capabilities.broadcast;

  return (
    <div className={`flex shrink-0 items-center gap-3 ${compact ? "flex-wrap justify-end" : ""}`}>
      <WhatsAppConnectionStatus connection={connection} compact={compact} reconnectHref="/client/account/whatsapp" />
      {showBroadcast ? (
        <Link
          href="/client/marketing/campaigns/new"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-sales-brand px-2.5 text-[12px] font-semibold text-sales-brand-text transition-colors hover:brightness-[0.97]"
        >
          <Send size={13} strokeWidth={1.8} aria-hidden />
          Broadcast
        </Link>
      ) : null}
    </div>
  );
}

export function CompanyWhatsAppHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  connection,
  variant = "page",
  agentActive = false,
}: {
  unreadNotifications?: number;
  notificationRole?: UserRole;
  userName?: string;
  avatarUrl?: string | null;
  connection: SafeWhatsAppConnection | null;
  variant?: "page" | "list";
  agentActive?: boolean;
}) {
  if (variant === "list") {
    return (
      <header className="company-wa-list-header shrink-0 border-b border-sales-border bg-sales-surface px-4 py-3">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-sales-text-primary">
            WhatsApp Sales Hub
          </h1>
          <HubAgentLabel active={agentActive} />
        </div>
        <div className="mt-1">
          <ConnectionCluster connection={connection} />
        </div>
      </header>
    );
  }

  return (
    <header className="company-wa-page-header flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-sales-border bg-sales-bg px-4 py-2 sm:px-5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
            WhatsApp Sales Hub
          </h1>
          <HubAgentLabel active={agentActive} />
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 layout:flex">
        <div className="sd-search-wrap hidden w-[min(24vw,320px)] min-w-[220px] min-[1280px]:block">
          <GlobalSearch role={notificationRole!} placeholder="Search conversations…" />
        </div>
        <NotificationBell initialUnread={unreadNotifications ?? 0} role={notificationRole!} />
        <SalesThemeToggle />
        <SalesProfileMenu
          userName={userName ?? "Manager"}
          userRoleLabel="Company Manager"
          avatarUrl={avatarUrl}
          profileHref="/client/account"
          helpHref="/client/account"
          helpLabel="Help & Support"
          compact
        />
        <ConnectionCluster connection={connection} compact />
      </div>
    </header>
  );
}
