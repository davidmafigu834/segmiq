"use client";

import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";

function relativeSynced(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `last synced ${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `last synced ${minutes} min ago`;
  return `last synced ${Math.round(minutes / 60)}h ago`;
}

export function SalespersonHubHeader({
  connection,
  title = "WhatsApp Sales Hub",
}: {
  connection: SafeWhatsAppConnection | null;
  title?: string;
}) {
  const connected = connection?.connected === true;
  const pending = Boolean(
    connection && ["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(connection.status)
  );
  const synced = relativeSynced(connection?.lastSeenAt ?? connection?.connectedAt ?? null);

  return (
    <header className="salesperson-wa-page-header flex min-h-[56px] shrink-0 items-start justify-between gap-3 px-4 py-2.5 sm:px-5">
      <div className="min-w-0">
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
          {title}
        </h1>
        <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
          Your selling workspace for WhatsApp
        </p>
      </div>
      <div className="shrink-0 pt-1 text-right">
        {connected ? (
          <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-[#168A42]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" aria-hidden />
            WhatsApp connected
          </p>
        ) : pending ? (
          <p className="text-[11px] font-medium text-sales-warning-fg">WhatsApp connecting…</p>
        ) : (
          <div>
            <p className="text-[11px] font-semibold text-sales-danger-fg">WhatsApp temporarily offline</p>
            <p className="mt-0.5 max-w-[220px] text-[10px] leading-snug text-sales-text-muted">
              Messages cannot send until your company reconnects WhatsApp.
            </p>
          </div>
        )}
        {connected && synced ? (
          <p className="mt-0.5 text-[10px] text-sales-text-muted">{synced}</p>
        ) : null}
      </div>
    </header>
  );
}
