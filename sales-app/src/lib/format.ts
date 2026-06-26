export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatFollowUpDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function leadDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed || "Unknown lead";
}

export function leadInitials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: "New",
    CONTACTED: "Contacted",
    NEGOTIATING: "Negotiating",
    PROPOSAL_SENT: "Proposal sent",
    WON: "Won",
    LOST: "Lost",
    NOT_QUALIFIED: "Not qualified",
  };
  return map[status] ?? status;
}

export type StatusTone = "new" | "active" | "proposal" | "won" | "lost" | "neutral";

export function statusTone(status: string): StatusTone {
  switch (status) {
    case "NEW":
      return "new";
    case "CONTACTED":
    case "NEGOTIATING":
      return "active";
    case "PROPOSAL_SENT":
      return "proposal";
    case "WON":
      return "won";
    case "LOST":
    case "NOT_QUALIFIED":
      return "lost";
    default:
      return "neutral";
  }
}

export const STATUS_TONE_CLASSES: Record<
  StatusTone,
  { badge: string; ring: string; dot: string }
> = {
  new: {
    badge: "bg-accent-muted text-accent border-accent-border",
    ring: "ring-accent-border",
    dot: "bg-accent",
  },
  active: {
    badge: "bg-[rgba(61,214,140,0.12)] text-[var(--success)] border-[rgba(61,214,140,0.3)]",
    ring: "ring-[rgba(61,214,140,0.25)]",
    dot: "bg-[var(--success)]",
  },
  proposal: {
    badge: "bg-[rgba(245,166,35,0.12)] text-[var(--warning)] border-[rgba(245,166,35,0.3)]",
    ring: "ring-[rgba(245,166,35,0.25)]",
    dot: "bg-[var(--warning)]",
  },
  won: {
    badge: "bg-[rgba(61,214,140,0.12)] text-[var(--success)] border-[rgba(61,214,140,0.3)]",
    ring: "ring-[rgba(61,214,140,0.25)]",
    dot: "bg-[var(--success)]",
  },
  lost: {
    badge: "bg-[rgba(255,68,68,0.12)] text-[var(--error)] border-[rgba(255,68,68,0.3)]",
    ring: "ring-[rgba(255,68,68,0.25)]",
    dot: "bg-[var(--error)]",
  },
  neutral: {
    badge: "bg-bg-quaternary text-ink-secondary border-border",
    ring: "ring-border",
    dot: "bg-ink-tertiary",
  },
};

export function scoreHeat(score: number | null | undefined): "hot" | "warm" | "cold" {
  if (typeof score !== "number") return "warm";
  if (score >= 60) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function formatMoney(amount: number, currency = "USD"): string {
  const n = (Number(amount) || 0).toFixed(2);
  const withSep = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${withSep}`;
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
