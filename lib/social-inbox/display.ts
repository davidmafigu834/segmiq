import type {
  SocialChannel,
  SocialConnectionStatus,
  SocialInboxViewId,
  SocialIntentBand,
  SocialQueueItem,
} from "./types";

export const SOCIAL_VIEW_LABELS: Record<SocialInboxViewId, string> = {
  for_you: "For You",
  hot: "Hot Opportunities",
  needs_reply: "Needs Reply",
  follow_up: "Follow Up",
  dms: "DMs",
  comments: "Comments",
  converted: "Converted",
  unassigned: "Unassigned",
};

export const SOCIAL_VIEW_ORDER: SocialInboxViewId[] = [
  "for_you",
  "hot",
  "needs_reply",
  "follow_up",
  "dms",
  "comments",
  "converted",
  "unassigned",
];

export function channelNetwork(channel: SocialChannel): "facebook" | "instagram" {
  return channel.startsWith("instagram") ? "instagram" : "facebook";
}

export function channelKindLabel(channel: SocialChannel): string {
  switch (channel) {
    case "facebook_messenger":
      return "Messenger";
    case "facebook_comment":
      return "Page comment";
    case "facebook_ad_comment":
      return "Ad comment";
    case "instagram_dm":
      return "Instagram DM";
    case "instagram_comment":
      return "Post comment";
    case "instagram_ad_comment":
      return "Ad comment";
    default:
      return "Social";
  }
}

export function channelNetworkLabel(channel: SocialChannel): string {
  return channelNetwork(channel) === "instagram" ? "Instagram" : "Facebook";
}

export function channelShortLabel(channel: SocialChannel): string {
  const network = channelNetworkLabel(channel);
  const kind = channel.includes("comment") ? "Comment" : "DM";
  return `${network} · ${kind}`;
}

export function intentBandLabel(band: SocialIntentBand): string {
  if (band === "hot") return "Hot";
  if (band === "warm") return "Warm";
  return "Cold";
}

export function connectionStatusLabel(status: SocialConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "attention_required":
      return "Attention required";
    case "disconnected":
      return "Disconnected";
    case "auth_expired":
      return "Authorisation expired";
    case "sync_issue":
      return "Sync issue";
    default:
      return "Unknown";
  }
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function originHeadline(item: SocialQueueItem): string | null {
  const origin = item.origin;
  if (!origin) return null;
  if (origin.campaignName) return origin.campaignName;
  if (origin.adName) return origin.adName;
  if (origin.kind === "advertisement") return "Facebook Ad";
  if (origin.kind === "reel") return "Instagram Reel";
  if (origin.kind === "post") return "Organic post";
  return null;
}

export function replyModeLabel(mode: "public_comment" | "private_dm"): string {
  return mode === "public_comment" ? "Public comment" : "Private message";
}

export function sendButtonLabel(mode: "public_comment" | "private_dm"): string {
  return mode === "public_comment" ? "Reply publicly" : "Send privately";
}

export function formatWaitingDuration(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const minutes = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (minutes < 60) return `Waiting ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Waiting ${hours}h`;
  const days = Math.round(hours / 24);
  return `Waiting ${days}d`;
}

export function signalChipLabel(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("price") || lower.includes("deposit") || lower.includes("pricing")) return "Pricing";
  if (lower.includes("financ")) return "Financing";
  if (lower.includes("available") || lower.includes("stock")) return "Availability";
  if (lower.includes("deliver")) return "Delivery";
  if (lower.includes("install") || lower.includes("location") || lower.includes("area")) return "Location";
  if (lower.includes("quot")) return "Quotation";
  if (lower.includes("call") || lower.includes("callback")) return "Callback";
  if (lower.includes("follow")) return "Follow-up";
  return reason.replace(/^Asked (about |if it is |whether )?/i, "").replace(/\.$/, "");
}
