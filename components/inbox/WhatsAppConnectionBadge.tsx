"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Settings2, WifiOff } from "lucide-react";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";

export function WhatsAppConnectionBadge({ connection, canManage = false, compact = false }: {
  connection: SafeWhatsAppConnection | null;
  canManage?: boolean;
  compact?: boolean;
}) {
  const pending = Boolean(connection && ["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(connection.status));
  const connected = connection?.connected === true;
  const icon = connected ? <CheckCircle2 size={14} /> : pending ? <Loader2 size={14} className="animate-spin" /> : connection?.status === "ERROR" || connection?.status === "RECONNECT_REQUIRED" ? <AlertTriangle size={14} /> : <WifiOff size={14} />;
  const label = connected ? `${connection?.providerLabel ?? "WhatsApp"} connected` : pending ? "WhatsApp connecting" : "WhatsApp disconnected";
  const className = `inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[11px] font-semibold ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : pending ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"}`;
  const content = <>{icon}{compact ? (connected ? "Connected" : pending ? "Connecting" : "Offline") : label}{canManage ? <Settings2 size={12} /> : null}</>;
  return canManage ? <Link href="/client/account/whatsapp" className={className} title={`${label}. Manage connection settings.`}>{content}</Link> : <span className={className} title={label}>{content}</span>;
}
