const PALETTE = [
  "#5FD3A3",
  "#F5A623",
  "#7C9FFF",
  "#FF8FB3",
  "#4FD4E8",
];

export function hashRepColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function assigneeBadgeColor(
  repName: string | null | undefined,
  currentRepName: string | null | undefined
): string {
  if (!repName) return "transparent";
  if (currentRepName && repName.trim() === currentRepName.trim()) {
    return "var(--accent)";
  }
  return hashRepColor(repName);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
