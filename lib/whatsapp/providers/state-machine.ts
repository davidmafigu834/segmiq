import type { WhatsAppConnectionState } from "./types";

const TRANSITIONS: Record<WhatsAppConnectionState, readonly WhatsAppConnectionState[]> = {
  DISCONNECTED: ["INITIALIZING"],
  INITIALIZING: ["AWAITING_QR", "CONNECTING", "ERROR", "DISCONNECTED"],
  // Baileys may report `open` in the same lifecycle turn that follows the
  // scan, without a separately observable `connecting` event.
  AWAITING_QR: ["CONNECTING", "CONNECTED", "RECONNECT_REQUIRED", "ERROR", "DISCONNECTING", "DISCONNECTED"],
  CONNECTING: ["AWAITING_QR", "CONNECTED", "RECONNECTING", "RECONNECT_REQUIRED", "ERROR", "DISCONNECTING"],
  CONNECTED: ["DEGRADED", "RECONNECTING", "RECONNECT_REQUIRED", "DISCONNECTING", "ERROR"],
  DEGRADED: ["CONNECTED", "RECONNECTING", "RECONNECT_REQUIRED", "DISCONNECTING", "ERROR"],
  RECONNECTING: ["CONNECTING", "CONNECTED", "RECONNECT_REQUIRED", "ERROR", "DISCONNECTING"],
  RECONNECT_REQUIRED: ["INITIALIZING", "RECONNECTING", "DISCONNECTING", "DISCONNECTED"],
  DISCONNECTING: ["DISCONNECTED", "ERROR"],
  ERROR: ["INITIALIZING", "RECONNECTING", "DISCONNECTING", "DISCONNECTED"],
};

export function canTransitionWhatsAppConnection(
  from: WhatsAppConnectionState,
  to: WhatsAppConnectionState
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertWhatsAppConnectionTransition(
  from: WhatsAppConnectionState,
  to: WhatsAppConnectionState
): void {
  if (!canTransitionWhatsAppConnection(from, to)) {
    throw new Error(`Invalid WhatsApp connection transition: ${from} -> ${to}`);
  }
}
