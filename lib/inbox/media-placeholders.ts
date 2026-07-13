const MEDIA_PLACEHOLDER_BODIES = new Set([
  "photo",
  "voice message",
  "[voice message]",
  "video",
  "document",
  "sticker",
  "attachment",
  "location",
  "[audio]",
  "[image]",
  "[video]",
  "[document]",
  "[sticker]",
  "[location]",
]);

export function isMediaPlaceholderBody(
  body: string | null | undefined,
  messageType?: string | null
): boolean {
  const trimmed = body?.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  if (MEDIA_PLACEHOLDER_BODIES.has(normalized)) return true;
  if (messageType && normalized === `[${messageType.toLowerCase()}]`) return true;
  return false;
}

export function isMediaMessageType(messageType?: string | null): boolean {
  return (
    messageType === "image" ||
    messageType === "audio" ||
    messageType === "video" ||
    messageType === "document" ||
    messageType === "sticker"
  );
}
