/**
 * Decides whether a gateway socket may publish a QR code and whether it must
 * discard stored credentials. Unattended restore must never show a QR; an
 * admin sitting on the connect modal must never reuse a logged-out session,
 * which 401s immediately and never emits a code.
 */
export type WhatsAppPairingDecision = {
  allowQr: boolean;
  freshPairing: boolean;
};

export function pairingForAdminConnect(): WhatsAppPairingDecision {
  return { allowQr: true, freshPairing: true };
}

export function pairingForRestore(): WhatsAppPairingDecision {
  return { allowQr: false, freshPairing: false };
}

export function pairingForAutoRetry(current: WhatsAppPairingDecision): WhatsAppPairingDecision {
  return { allowQr: current.allowQr, freshPairing: false };
}

export function pairingAfterLoggedOut(current: WhatsAppPairingDecision): WhatsAppPairingDecision | null {
  if (current.allowQr && !current.freshPairing) return { allowQr: true, freshPairing: true };
  return null;
}

/**
 * A linked device drops often. Only a real sign-out stops the socket.
 * 401 logged out, 403 forbidden, and 411 device mismatch need a new QR scan.
 * 515 is WhatsApp asking for a new socket. 440 means another socket still
 * holds the device. Everything else keeps trying.
 */
const QR_REQUIRED_CODES = new Set([401, 403, 411]);

export type SocketClosePlan =
  | { action: "qr_required"; errorCode: string; errorMessage: string }
  | { action: "retry"; delayMs: number; attempts: number };

export function planSocketClose(input: { code: number | undefined; attempts: number }): SocketClosePlan {
  if (input.code !== undefined && QR_REQUIRED_CODES.has(input.code)) {
    return {
      action: "qr_required",
      errorCode: String(input.code),
      errorMessage: "The linked phone signed out. Scan a new QR code to reconnect.",
    };
  }
  const attempts = input.code === 515 ? input.attempts : input.attempts + 1;
  const delayMs =
    input.code === 440
      ? Math.min(60_000, 20_000 * Math.max(attempts, 1))
      : input.code === 515
        ? 1_000
        : Math.min(60_000, 1_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 6));
  return { action: "retry", delayMs, attempts };
}

/** Keep messages from the minute before a live socket dropped. Later retries keep that mark. */
export function acceptAfterForResume(input: {
  droppedAt: number;
  previousAcceptAfter: number;
  wasOpen: boolean;
}): number {
  if (!input.wasOpen) return input.previousAcceptAfter;
  return Math.max(0, input.droppedAt - 60_000);
}

/** A process restart should still collect chats from the gap, and not the whole history. */
export function acceptAfterForRestore(now: number): number {
  return now - 6 * 60 * 60 * 1000;
}
