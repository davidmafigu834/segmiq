import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";

export type WhatsAppConnectionPresentation = "unknown" | "connected" | "pending" | "offline";

const PENDING_STATUSES = new Set(["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"]);

/** Null means the status request has not resolved. That is not the same as offline. */
export function whatsAppConnectionPresentation(
  connection: Pick<SafeWhatsAppConnection, "connected" | "status"> | null
): WhatsAppConnectionPresentation {
  if (!connection) return "unknown";
  if (connection.connected) return "connected";
  if (PENDING_STATUSES.has(connection.status)) return "pending";
  return "offline";
}
