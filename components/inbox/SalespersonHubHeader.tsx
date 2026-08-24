"use client";

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
}: {
  connection: SafeWhatsAppConnection | null;
  title?: string;
  variant?: "page" | "list";
  agentActive?: boolean;
}) {
  if (variant === "list") {
    return (
      <header className="salesperson-wa-list-header shrink-0 border-b border-sales-border bg-sales-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-sales-text-primary">
            {title}
          </h1>
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

  return (
    <header className="salesperson-wa-page-header flex min-h-[56px] shrink-0 items-start justify-between gap-3 px-4 py-2.5 sm:px-5">
      <div className="min-w-0">
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
          {title}
        </h1>
        <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
          Your selling workspace for WhatsApp
          {agentActive ? " · SegmiQ Agent active" : ""}
        </p>
      </div>
      <ConnectionStatus connection={connection} />
    </header>
  );
}
