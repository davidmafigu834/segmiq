"use client";

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

function ConnectionStatus({
  connection,
  compact = false,
}: {
  connection: SafeWhatsAppConnection | null;
  compact?: boolean;
}) {
  const connected = connection?.connected === true;
  const pending = Boolean(
    connection && ["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(connection.status)
  );
  const synced = relativeSynced(connection?.lastSeenAt ?? connection?.connectedAt ?? null);

  if (connected) {
    return (
      <div className={compact ? "text-right" : "mt-1.5 shrink-0 text-left"}>
        <p className={`flex items-center gap-1.5 text-[11px] font-medium text-[#168A42] ${compact ? "justify-end" : ""}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" aria-hidden />
          WhatsApp connected
        </p>
        {synced ? <p className="mt-0.5 text-[10px] text-sales-text-muted">{synced}</p> : null}
      </div>
    );
  }

  if (pending) {
    return (
      <p className={`text-[11px] font-medium text-sales-warning-fg ${compact ? "text-right" : ""}`}>
        WhatsApp connecting…
      </p>
    );
  }

  return (
    <div className={compact ? "text-right" : "shrink-0 pt-1 text-right"}>
      <p className="text-[11px] font-semibold text-sales-danger-fg">WhatsApp temporarily offline</p>
      {!compact ? (
        <p className="mt-0.5 max-w-[220px] text-[10px] leading-snug text-sales-text-muted">
          Messages cannot send until your company reconnects WhatsApp.
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] text-sales-text-muted">Messaging unavailable</p>
      )}
    </div>
  );
}

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
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-sales-text-primary">
            {title}
          </h1>
          <span className="inline-flex shrink-0 rounded-full border border-sales-border bg-sales-surface-subtle px-2 py-0.5 text-[9px] font-semibold text-sales-text-secondary">
            Sales
          </span>
          {agentActive ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Agent active
            </span>
          ) : null}
        </div>
        <ConnectionStatus connection={connection} />
      </header>
    );
  }

  const showTools = Boolean(notificationRole);

  return (
    <header className="salesperson-wa-page-header flex min-h-[56px] shrink-0 items-start justify-between gap-3 border-b border-sales-border bg-sales-bg px-4 py-2.5 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
            {title}
          </h1>
          <span className="inline-flex shrink-0 rounded-full border border-sales-border bg-sales-surface px-2 py-0.5 text-[10px] font-semibold text-sales-text-secondary">
            Sales
          </span>
          {agentActive ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              SegmiQ Agent active
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
          Your selling workspace for WhatsApp
        </p>
      </div>

      {showTools ? (
        <div className="hidden shrink-0 flex-col items-end gap-1 layout:flex">
          <div className="flex items-center gap-2">
            <div className="sd-search-wrap hidden w-[min(24vw,320px)] min-w-[220px] min-[1280px]:block">
              <GlobalSearch role={notificationRole!} placeholder="Search conversations..." />
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell initialUnread={unreadNotifications ?? 0} role={notificationRole!} />
              <SalesThemeToggle />
            </div>
            <SalesProfileMenu
              userName={userName ?? "Sales"}
              userRoleLabel="Sales Executive"
              avatarUrl={avatarUrl}
              compact
            />
          </div>
          <ConnectionStatus connection={connection} compact />
        </div>
      ) : (
        <ConnectionStatus connection={connection} />
      )}
    </header>
  );
}
