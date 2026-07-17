import { apiGet, apiPost } from "./api";
import type { NotificationRow } from "./notification-types";

export async function fetchNotifications(limit = 20): Promise<{
  notifications: NotificationRow[];
  unreadCount: number;
}> {
  const res = await apiGet<{ notifications?: NotificationRow[]; unreadCount?: number }>(
    `/api/notifications?limit=${limit}`
  );
  if (!res.ok) {
    throw new Error("Failed to load notifications");
  }
  return {
    notifications: res.data.notifications ?? [],
    unreadCount: res.data.unreadCount ?? 0,
  };
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await apiPost<{ ok?: boolean }>("/api/notifications/mark-read", {});
  if (!res.ok) throw new Error("Failed to mark notifications read");
}

export function notificationTypeLabel(type: string): string {
  switch (type) {
    case "NEW_LEAD":
      return "New lead";
    case "FOLLOW_UP_DUE":
      return "Follow-up due";
    case "FOLLOW_UP_PREP":
      return "Follow-up tomorrow";
    case "DEAL_WON":
      return "Deal won";
    case "LEAD_FLAG":
      return "Flagged";
    case "UNCONTACTED_MANAGER_ALERT":
      return "Uncontacted lead";
    default:
      return type.replace(/_/g, " ").toLowerCase();
  }
}

export function formatNotificationTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
