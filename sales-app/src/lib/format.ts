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

export function scoreHeat(score: number | null | undefined): "hot" | "warm" | "cold" {
  if (typeof score !== "number") return "warm";
  if (score >= 60) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
