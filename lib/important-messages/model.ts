export type ImportantCategory = "approvals" | "collaboration" | "whats_new";
export type ImportantPriority = "action" | "info" | "notice";

export type ImportantMessage = {
  id: string;
  source: "notification" | "announcement" | "introduction";
  category: ImportantCategory;
  priority: ImportantPriority;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  href: string | null;
  actionLabel: string | null;
  resolved: boolean;
};

const PHONE_LIKE = /\+?\d[\d\s().-]{7,}\d/;

export function redactPrivateContact(text: string): string {
  return text.replace(PHONE_LIKE, "").replace(/\s{2,}/g, " ").trim();
}

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.toLowerCase().includes("javascript:")) {
    return null;
  }
  if (path.length > 240) return null;
  return path;
}

export function introductionDestination(input: {
  role: string | null | undefined;
  introductionId: string | null;
}): string | null {
  if (!input.introductionId) return null;
  const base = input.role === "SALESPERSON" ? "/sales/buyers/introductions" : "/client/buyers/introductions";
  return safeInternalPath(`${base}?open=${input.introductionId}`);
}

export function mapIntroductionNotification(input: {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  introductionId: string | null;
  role: string | null | undefined;
}): ImportantMessage | null {
  const message = redactPrivateContact(input.message);
  const href = introductionDestination({ role: input.role, introductionId: input.introductionId });
  if (message.startsWith("Introduction requested")) {
    return {
      id: input.id,
      source: "notification",
      category: "approvals",
      priority: "action",
      title: "Buyer introduction requested",
      description: "An agent wants to collaborate on a matching property.",
      createdAt: input.createdAt,
      read: input.read,
      href,
      actionLabel: href ? "Review introduction" : null,
      resolved: false,
    };
  }
  if (message.startsWith("Your introduction request was approved")) {
    return {
      id: input.id,
      source: "notification",
      category: "collaboration",
      priority: "info",
      title: "Introduction approved",
      description: "Your request to connect with a matching buyer was approved.",
      createdAt: input.createdAt,
      read: input.read,
      href,
      actionLabel: href ? "View introduction" : null,
      resolved: true,
    };
  }
  if (message.startsWith("Your introduction request was declined")) {
    return {
      id: input.id,
      source: "notification",
      category: "collaboration",
      priority: "info",
      title: "Introduction declined",
      description: "Your buyer introduction request was declined.",
      createdAt: input.createdAt,
      read: input.read,
      href,
      actionLabel: href ? "View request" : null,
      resolved: true,
    };
  }
  return null;
}

export function viewerCanReviewIntroduction(input: {
  requesterId: string | null;
  viewerId: string;
  viewerRole: string | null | undefined;
  assigneeId: string | null;
  assigneeActive: boolean;
}): boolean {
  if (input.requesterId && input.requesterId === input.viewerId) return false;
  if (input.viewerRole === "CLIENT_MANAGER" || input.viewerRole === "SUPER_ADMIN") return true;
  return Boolean(input.assigneeId && input.assigneeId === input.viewerId && input.assigneeActive);
}

export function pendingIntroductionMessage(input: {
  id: string;
  createdAt: string;
  place: string | null;
  role: string | null | undefined;
}): ImportantMessage {
  const place = input.place?.replace(PHONE_LIKE, "").replace(/\s{2,}/g, " ").trim();
  const href = introductionDestination({ role: input.role, introductionId: input.id });
  return {
    id: `introduction:${input.id}`,
    source: "introduction",
    category: "approvals",
    priority: "action",
    title: "Buyer introduction requested",
    description: place
      ? `An agent wants to collaborate on a matching property in ${place}.`
      : "An agent wants to collaborate on a matching property.",
    createdAt: input.createdAt,
    read: false,
    href,
    actionLabel: href ? "Review introduction" : null,
    resolved: false,
  };
}

export function introductionIdFromMessage(item: ImportantMessage): string | null {
  if (item.id.startsWith("introduction:")) return item.id.slice("introduction:".length);
  const match = item.href?.match(/[?&]open=([^&]+)/);
  return match?.[1] ?? null;
}

export type AnnouncementAudience = "all" | "industry" | "role" | "organisation";

export function announcementVisible(input: {
  status: string;
  publishedAt: string | null;
  expiresAt: string | null;
  now: Date;
  audience: AnnouncementAudience;
  industry: string | null;
  roleTarget: string | null;
  clientId: string | null;
  viewerRole: string | null | undefined;
  viewerClientId: string | null;
  viewerBusinessType: string | null;
}): boolean {
  if (input.status !== "published" || !input.publishedAt) return false;
  if (new Date(input.publishedAt).getTime() > input.now.getTime()) return false;
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= input.now.getTime()) return false;
  if (input.audience === "all") return true;
  if (input.audience === "industry") return Boolean(input.industry && input.viewerBusinessType === input.industry);
  if (input.audience === "role") return Boolean(input.roleTarget && input.viewerRole === input.roleTarget);
  if (input.audience === "organisation") return Boolean(input.clientId && input.viewerClientId === input.clientId);
  return false;
}

export function canPublishAnnouncements(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export function unreadImportantCount(items: ImportantMessage[]): number {
  return items.filter((item) => !item.read).length;
}

export function filterImportantMessages(items: ImportantMessage[], category: "all" | ImportantCategory): ImportantMessage[] {
  const selected = category === "all" ? items : items.filter((item) => item.category === category);
  const rank = { action: 0, notice: 1, info: 2 };
  return [...selected].sort((a, b) => {
    const priority = rank[a.priority] - rank[b.priority];
    if (priority !== 0) return priority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function compactUnreadCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}
