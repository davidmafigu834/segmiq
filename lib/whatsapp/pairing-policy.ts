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
