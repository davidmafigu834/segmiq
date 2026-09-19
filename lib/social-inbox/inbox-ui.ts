import { matchesView, sortQueue } from "./ranking";
import { signalChipLabel } from "./display";
import type { SocialInboxViewId, SocialQueueItem } from "./types";

export type ComposerMode = "reply" | "internal_note" | "public_reply" | "private_message";

export type TeamScope = "mine" | "team" | string;

export type QueueGroup = {
  id: "now" | "today" | "follow_up" | "overdue" | "upcoming" | "all";
  label: string;
  items: SocialQueueItem[];
};

export type InboxFilterState = {
  facebook: boolean;
  instagram: boolean;
  dm: boolean;
  comment: boolean;
  hot: boolean;
  warm: boolean;
  cold: boolean;
  needsReply: boolean;
  followUp: boolean;
  converted: boolean;
  ownerId: string | null;
  existingCustomer: boolean;
  newPerson: boolean;
  hasOpenDeal: boolean;
  campaign: string;
  commentsBuyersOnly: boolean;
  dmNetwork: "all" | "facebook" | "instagram";
};

export const EMPTY_FILTERS: InboxFilterState = {
  facebook: false,
  instagram: false,
  dm: false,
  comment: false,
  hot: false,
  warm: false,
  cold: false,
  needsReply: false,
  followUp: false,
  converted: false,
  ownerId: null,
  existingCustomer: false,
  newPerson: false,
  hasOpenDeal: false,
  campaign: "",
  commentsBuyersOnly: false,
  dmNetwork: "all",
};

export function parseInboxView(raw: string | null | undefined): SocialInboxViewId {
  const v = raw ?? "for_you";
  if (
    v === "for_you" ||
    v === "hot" ||
    v === "needs_reply" ||
    v === "follow_up" ||
    v === "dms" ||
    v === "comments" ||
    v === "converted" ||
    v === "unassigned"
  ) {
    return v;
  }
  return "for_you";
}

export function activeFilterCount(filters: InboxFilterState): number {
  let n = 0;
  if (filters.facebook) n += 1;
  if (filters.instagram) n += 1;
  if (filters.dm) n += 1;
  if (filters.comment) n += 1;
  if (filters.hot) n += 1;
  if (filters.warm) n += 1;
  if (filters.cold) n += 1;
  if (filters.needsReply) n += 1;
  if (filters.followUp) n += 1;
  if (filters.converted) n += 1;
  if (filters.ownerId) n += 1;
  if (filters.existingCustomer) n += 1;
  if (filters.newPerson) n += 1;
  if (filters.hasOpenDeal) n += 1;
  if (filters.campaign.trim()) n += 1;
  return n;
}

export function applyInboxFilters(items: SocialQueueItem[], filters: InboxFilterState): SocialQueueItem[] {
  const typeOn = filters.dm || filters.comment;
  const intentOn = filters.hot || filters.warm || filters.cold;
  const statusOn = filters.needsReply || filters.followUp || filters.converted;
  const campaign = filters.campaign.trim().toLowerCase();

  return items.filter((item) => {
    const isIg = item.channel.startsWith("instagram");
    if (filters.facebook !== filters.instagram) {
      if (filters.facebook && isIg) return false;
      if (filters.instagram && !isIg) return false;
    }

    if (typeOn) {
      if (filters.dm && !filters.comment && item.conversationKind !== "dm") return false;
      if (filters.comment && !filters.dm && item.conversationKind !== "comment") return false;
    }
    if (intentOn) {
      const ok =
        (filters.hot && item.intentBand === "hot") ||
        (filters.warm && item.intentBand === "warm") ||
        (filters.cold && item.intentBand === "cold");
      if (!ok) return false;
    }
    if (statusOn) {
      const ok =
        (filters.needsReply && item.unread) ||
        (filters.followUp && Boolean(item.followUpLabel)) ||
        (filters.converted && item.crmState === "converted");
      if (!ok) return false;
    }
    if (filters.ownerId && item.assignedToId !== filters.ownerId) return false;
    if (filters.existingCustomer && item.crmState === "none") return false;
    if (filters.newPerson && item.crmState !== "none") return false;
    if (filters.hasOpenDeal && item.crmState !== "open_deal") return false;
    if (campaign) {
      const hay = `${item.origin?.campaignName ?? ""} ${item.origin?.adName ?? ""}`.toLowerCase();
      if (!hay.includes(campaign)) return false;
    }
    return true;
  });
}

export function filterQueue(
  items: SocialQueueItem[],
  view: SocialInboxViewId,
  viewerId: string,
  filters: InboxFilterState,
  query: string,
  teamScope: TeamScope,
  canViewUnassigned: boolean
): SocialQueueItem[] {
  let next = items.filter((item) => {
    if (item.followUpLabel === "Snoozed") return view === "follow_up";
    if (!canViewUnassigned && !item.assignedToId) return false;
    if (teamScope === "mine") {
      return item.assignedToId === viewerId;
    }
    if (teamScope !== "team") {
      return item.assignedToId === teamScope;
    }
    return true;
  });

  next = next.filter((item) => matchesView(item, view));
  next = applyInboxFilters(next, filters);

  if (view === "comments" && filters.commentsBuyersOnly) {
    next = next.filter((item) => item.intentBand !== "cold");
  }
  if (view === "dms" && filters.dmNetwork !== "all") {
    next = next.filter((item) =>
      filters.dmNetwork === "instagram" ? item.channel.startsWith("instagram") : !item.channel.startsWith("instagram")
    );
  }

  const q = query.trim().toLowerCase();
  if (q) {
    next = next.filter((item) =>
      `${item.displayName} ${item.preview} ${item.detectedProduct ?? ""} ${item.username ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }

  return sortQueue(next, view, viewerId);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function groupQueue(items: SocialQueueItem[], view: SocialInboxViewId): QueueGroup[] {
  if (view === "follow_up") {
    const overdue: SocialQueueItem[] = [];
    const today: SocialQueueItem[] = [];
    const upcoming: SocialQueueItem[] = [];
    for (const item of items) {
      const label = (item.followUpLabel ?? "").toLowerCase();
      if (label.includes("overdue")) overdue.push(item);
      else if (label.includes("today") || label.includes("later today")) today.push(item);
      else upcoming.push(item);
    }
    return [
      overdue.length ? { id: "overdue", label: `Overdue ${overdue.length}`, items: overdue } : null,
      today.length ? { id: "today", label: `Today ${today.length}`, items: today } : null,
      upcoming.length ? { id: "upcoming", label: "Upcoming", items: upcoming } : null,
    ].filter(Boolean) as QueueGroup[];
  }

  if (view !== "for_you") {
    return [{ id: "all", label: "", items }];
  }

  const now = Date.now();
  const todayStart = startOfDay(new Date());
  const nowItems: SocialQueueItem[] = [];
  const todayItems: SocialQueueItem[] = [];
  const followItems: SocialQueueItem[] = [];
  const rest: SocialQueueItem[] = [];

  for (const item of items) {
    if (item.followUpLabel) {
      followItems.push(item);
      continue;
    }
    const t = Date.parse(item.lastMessageAt ?? "") || 0;
    if (item.unread && now - t < 45 * 60_000) nowItems.push(item);
    else if (t >= todayStart) todayItems.push(item);
    else rest.push(item);
  }

  const leftover = [...todayItems, ...rest];
  return [
    nowItems.length ? { id: "now", label: "Now", items: nowItems } : null,
    leftover.length ? { id: "today", label: nowItems.length ? "Today" : "", items: leftover } : null,
    followItems.length ? { id: "follow_up", label: "Follow up", items: followItems } : null,
  ].filter(Boolean) as QueueGroup[];
}

export function viewCounts(items: SocialQueueItem[], viewerId: string, canViewUnassigned: boolean) {
  const visible = items.filter((item) => {
    if (!canViewUnassigned && !item.assignedToId) return false;
    return true;
  });
  const count = (view: SocialInboxViewId) => visible.filter((item) => matchesView(item, view)).length;
  return {
    for_you: count("for_you"),
    hot: count("hot"),
    needs_reply: count("needs_reply"),
    follow_up: count("follow_up"),
    dms: count("dms"),
    comments: count("comments"),
    converted: count("converted"),
    unassigned: count("unassigned"),
    attention: visible.filter((item) => item.unread || item.followUpLabel || (!item.assignedToId && item.intentBand === "hot"))
      .length,
  };
}

export function uniqueSignalChips(reasons: string[]): string[] {
  const chips: string[] = [];
  for (const reason of reasons) {
    const chip = signalChipLabel(reason);
    if (chip && !chips.includes(chip)) chips.push(chip);
  }
  return chips.slice(0, 4);
}

export function upcomingThursday(): Date {
  const d = new Date();
  const add = (4 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function formatFollowUpShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatFollowUpLong(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" }
  )}`;
}
