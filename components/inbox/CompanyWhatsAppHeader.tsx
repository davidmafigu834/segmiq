"use client";

import Link from "next/link";
import { ChevronDown, Send } from "lucide-react";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
import type { UserRole } from "@/types";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";

function relativeSynced(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `Last synced ${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Last synced ${minutes} min ago`;
  return `Last synced ${Math.round(minutes / 60)}h ago`;
}

export function CompanyWhatsAppHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  connection,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  connection: SafeWhatsAppConnection | null;
}) {
  const connected = connection?.connected === true;
  const pending = Boolean(
    connection && ["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(connection.status)
  );
  const synced = relativeSynced(connection?.lastSeenAt ?? connection?.connectedAt ?? null);
  const showBroadcast = connected && connection?.capabilities.broadcast;

  return (
    <header className="company-wa-page-header flex min-h-[56px] shrink-0 items-start justify-between gap-3 border-b border-sales-border bg-sales-bg px-4 py-2.5 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
            WhatsApp Sales Hub
          </h1>
          <span className="inline-flex shrink-0 rounded-full border border-sales-border bg-sales-surface px-2 py-0.5 text-[10px] font-semibold text-sales-text-secondary">
            Company
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
          Manage conversations, customer context and team responses in one place.
        </p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 layout:flex">
        <div className="flex items-center gap-1.5">
          <div className="sd-search-wrap hidden w-[min(24vw,320px)] min-w-[220px] min-[1280px]:block">
            <GlobalSearch role={notificationRole} placeholder="Search conversations…" />
          </div>
          <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
          <SalesThemeToggle />
          <SalesProfileMenu
            userName={userName}
            userRoleLabel="Company Manager"
            avatarUrl={avatarUrl}
            profileHref="/client/settings/profile"
            helpHref="/client/settings/profile"
            helpLabel="Help & Support"
          />
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <div className="text-right">
              <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-[#168A42]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" aria-hidden />
                WhatsApp connected
              </p>
              {synced ? <p className="text-[10px] text-sales-text-muted">{synced}</p> : null}
            </div>
          ) : pending ? (
            <p className="text-[11px] font-medium text-sales-warning-fg">WhatsApp connecting…</p>
          ) : (
            <div className="text-right">
              <p className="text-[11px] font-semibold text-sales-danger-fg">WhatsApp temporarily offline</p>
              <Link href="/client/account/whatsapp" className="text-[10px] font-semibold text-sales-link hover:underline">
                Reconnect
              </Link>
            </div>
          )}
          {showBroadcast ? (
            <Link
              href="/client/marketing/campaigns/new"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-sales-brand px-3 text-[11px] font-semibold text-sales-brand-text transition-colors hover:brightness-[0.97]"
              title="Create an approved-template WhatsApp campaign"
            >
              <Send size={14} strokeWidth={1.8} aria-hidden />
              Broadcast Message
              <ChevronDown size={12} strokeWidth={1.8} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
