/**
 * Pure helpers for the WhatsApp linked-device gateway. Kept free of Baileys
 * imports so the Next.js app and tests can cover the ingest rules without
 * loading the socket library.
 */

export type GatewayMessageKey = {
  id?: string | null;
  fromMe?: boolean | null;
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  participant?: string | null;
  participantAlt?: string | null;
};

export function isLiveUpsertType(type: string | undefined): boolean {
  // Companion devices often deliver customer messages as `append` rather than
  // `notify`. `prepend` is history and stays excluded.
  return type === "notify" || type === "append";
}

export function digitsFromJid(jid: string | null | undefined): string {
  if (!jid) return "";
  return jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
}

function isLidJid(jid: string | null | undefined): boolean {
  return (jid ?? "").toLowerCase().includes("@lid");
}

export function phoneFromWhatsAppKey(key: GatewayMessageKey | null | undefined): string {
  const candidates = [
    key?.remoteJidAlt,
    key?.participantAlt,
    key?.remoteJid,
    key?.participant,
  ];
  for (const jid of candidates) {
    if (!jid || isLidJid(jid)) continue;
    const digits = digitsFromJid(jid);
    if (digits.length >= 6) return digits;
  }
  for (const jid of candidates) {
    const digits = digitsFromJid(jid);
    if (digits.length >= 6) return digits;
  }
  return "";
}

export function isSelfWhatsAppChat(
  remoteJid: string,
  ownJids: Array<string | null | undefined>
): boolean {
  const remote = remoteJid.trim().toLowerCase();
  const remoteDigits = digitsFromJid(remoteJid);
  for (const own of ownJids) {
    if (!own) continue;
    if (own.trim().toLowerCase() === remote) return true;
    const ownDigits = digitsFromJid(own);
    if (remoteDigits && ownDigits && remoteDigits === ownDigits) return true;
  }
  return false;
}

export function messageTimestampMs(raw: unknown): number {
  let value = 0;
  if (typeof raw === "number" && Number.isFinite(raw)) value = raw;
  else if (typeof raw === "bigint") value = Number(raw);
  else if (typeof raw === "string" && raw.trim()) value = Number(raw);
  else if (raw && typeof raw === "object") {
    const candidate = raw as { toNumber?: () => number; low?: number; high?: number };
    if (typeof candidate.toNumber === "function") value = candidate.toNumber();
    else if (typeof candidate.low === "number") {
      const high = candidate.high ?? 0;
      value = high * 2 ** 32 + (candidate.low >>> 0);
    }
  }
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1e12 ? value : value * 1000;
}

function nestedMessage(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  return message as Record<string, unknown>;
}

export function unwrapWhatsAppContent(
  message: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  let content = message ?? null;
  for (let i = 0; i < 8 && content; i += 1) {
    const next =
      nestedMessage(content.ephemeralMessage) ??
      nestedMessage(content.viewOnceMessage) ??
      nestedMessage(content.viewOnceMessageV2) ??
      nestedMessage(content.viewOnceMessageV2Extension) ??
      nestedMessage(content.documentWithCaptionMessage) ??
      nestedMessage(content.editedMessage);
    if (!next) break;
    content = next;
  }
  return content;
}
