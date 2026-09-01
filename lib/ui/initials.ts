/** Stable initials + fallback background for avatars. */

const PALETTE = [
  "var(--avatar-palette-0, #EEF2FF)",
  "var(--avatar-palette-1, #ECFDF5)",
  "var(--avatar-palette-2, #FFF7ED)",
  "var(--avatar-palette-3, #F0F9FF)",
  "var(--avatar-palette-4, #F5F3FF)",
  "var(--avatar-palette-5, #FEF2F2)",
] as const;

function hashKey(key: string): number {
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum += key.charCodeAt(i);
  return Math.abs(sum) % PALETTE.length;
}

/**
 * Generate up to 2 uppercase initials from a display name.
 * Single word → first character only (e.g. "Chiedza" → "C").
 */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function getInitialsBackground(name: string | null | undefined): string {
  const key = (name ?? "").trim().toLowerCase() || "unknown";
  return PALETTE[hashKey(key)]!;
}

export function displayName(
  name: string | null | undefined,
  email?: string | null
): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  if (email?.trim()) return email.trim();
  return "Unknown user";
}
