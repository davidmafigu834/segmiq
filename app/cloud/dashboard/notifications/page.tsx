"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { CloudPage } from "@/app/cloud/components/CloudPage";

type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  lead_id: string | null;
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_LABEL: Record<string, string> = {
  NEW_LEAD: "New lead",
  FOLLOW_UP_DUE: "Follow-up due",
  FOLLOW_UP_PREP: "Follow-up tomorrow",
  DEAL_WON: "Deal won",
  LEAD_FLAG: "Lead flagged",
  PHOTO_UPLOADED: "Photo uploaded",
  STORAGE_WARNING: "Storage warning",
  TEAM_MEMBER_JOINED: "Team member joined",
  UNCONTACTED_MANAGER_ALERT: "Alert",
};

export default function NotificationsPage() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(() => {
    if (!session?.userId) return;
    setLoading(true);
    fetch("/api/cloud/notifications")
      .then((r) => r.json())
      .then((data: { notifications: Notification[]; unread: number }) => {
        setNotifications(data.notifications ?? []);
        setUnread(data.unread ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/cloud/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setMarkingAll(false);
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  async function markOneRead(id: string) {
    await fetch("/api/cloud/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <CloudPage narrow>
      <div className="mx-auto max-w-xl">
        {unread > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--cloud-text-secondary)]">{unread} unread</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAll}
              className="cloud-btn-ghost h-8 px-3 text-[12px] disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--cloud-text-disabled)]" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="cloud-card mb-4 flex h-14 w-14 items-center justify-center">
              <Bell className="h-6 w-6 text-[var(--cloud-text-secondary)]" strokeWidth={1.5} />
            </div>
            <p className="mb-1 font-cloud-display text-[18px] text-[var(--cloud-text-primary)]">No notifications yet</p>
            <p className="text-[13px] text-[var(--cloud-text-secondary)]">We&apos;ll let you know when something happens.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) void markOneRead(n.id); }}
                className={`cloud-card flex cursor-pointer items-start gap-3 px-4 py-4 transition-all active:scale-[0.99] ${
                  n.read
                    ? ""
                    : "border-[rgba(212,255,79,0.35)] bg-[var(--cloud-accent-muted)]"
                }`}
              >
                <div
                  className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                    n.read ? "bg-[var(--cloud-text-disabled)]" : "bg-[var(--cloud-ink)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-semibold ${n.read ? "text-[var(--cloud-text-tertiary)]" : "text-[var(--cloud-text-primary)]"}`}>
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-[var(--cloud-text-tertiary)]">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-[13px] leading-snug ${n.read ? "text-[var(--cloud-text-secondary)]" : "text-[var(--cloud-text-primary)]"}`}>
                    {n.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CloudPage>
  );
}
