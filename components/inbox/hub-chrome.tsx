"use client";

import Link from "next/link";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";
import { whatsAppConnectionPresentation } from "@/lib/inbox/connection-presentation";

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
  quiet = false,
}: {
  connection: SafeWhatsAppConnection | null;
  compact?: boolean;
  reconnectHref?: string;
  /** Hide a healthy connection so the chat list can start immediately. Offline stays visible. */
  quiet?: boolean;
}) {
  const presentation = whatsAppConnectionPresentation(connection);
  const synced = relativeSynced(connection?.lastSeenAt ?? connection?.connectedAt ?? null);

  if (presentation === "unknown") {
    return <p className="sr-only">Checking WhatsApp connection</p>;
  }

  if (presentation === "connected") {
    const label = `Connected${synced ? `, ${synced}` : ""}`;
    if (quiet) return <p className="sr-only">{label}</p>;
    return (
      <p className={`text-[12px] text-sales-text-secondary ${compact ? "text-right" : ""}`}>
        Connected{synced ? ` · ${synced}` : ""}
      </p>
    );
  }

  if (presentation === "pending") {
    return (
      <p className={`text-[12px] font-medium text-sales-warning-fg ${compact ? "text-right" : ""} ${quiet ? "px-3 py-2" : ""}`}>
        Connecting
      </p>
    );
  }

  if (quiet) {
    return (
      <div className="mt-2 flex min-h-11 items-center gap-2 rounded-[12px] bg-sales-danger-soft px-3" role="status">
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-4 text-sales-danger-fg">
          WhatsApp is offline. Messages cannot be sent.
        </p>
        {reconnectHref ? (
          <Link
            href={reconnectHref}
            className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-semibold text-sales-link"
          >
            Reconnect
          </Link>
        ) : null}
      </div>
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
