"use client";

import Link from "next/link";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";

function relativeSynced(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `Synced ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Synced ${minutes}m ago`;
  return `Synced ${Math.round(minutes / 60)}h ago`;
}

export function HubAgentLabel({ active }: { active?: boolean }) {
  if (!active) return null;
  return <span className="shrink-0 text-[12px] font-medium text-sales-text-secondary">Agent on</span>;
}

export function WhatsAppConnectionStatus({
  connection,
  compact = false,
  reconnectHref,
}: {
  connection: SafeWhatsAppConnection | null;
  compact?: boolean;
  reconnectHref?: string;
}) {
  const connected = connection?.connected === true;
  const pending = Boolean(
    connection && ["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(connection.status)
  );
  const synced = relativeSynced(connection?.lastSeenAt ?? connection?.connectedAt ?? null);

  if (connected) {
    return (
      <p className={`text-[12px] text-sales-text-secondary ${compact ? "text-right" : ""}`}>
        Connected{synced ? ` · ${synced}` : ""}
      </p>
    );
  }

  if (pending) {
    return (
      <p className={`text-[12px] font-medium text-sales-warning-fg ${compact ? "text-right" : ""}`}>
        Connecting
      </p>
    );
  }

  return (
    <div className={compact ? "text-right" : undefined}>
      <p className="text-[12px] font-medium text-sales-danger-fg">Offline</p>
      {reconnectHref ? (
        <Link href={reconnectHref} className="text-[12px] font-medium text-sales-link hover:underline">
          Reconnect
        </Link>
      ) : compact ? (
        <p className="text-[12px] text-sales-text-muted">Messaging unavailable</p>
      ) : (
        <p className="mt-0.5 max-w-[28ch] text-[12px] leading-snug text-sales-text-muted">
          Messages cannot send until WhatsApp is reconnected.
        </p>
      )}
    </div>
  );
}
