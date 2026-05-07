"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

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
    <div className="px-6 py-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-white">Notifications</h1>
            {unread > 0 && (
              <p className="text-[13px] text-white/40">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => void markAllRead()}
              disabled={markingAll}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[13px] text-white/60 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
              <Bell className="h-6 w-6 text-white/20" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-medium text-white/50">No notifications yet</p>
            <p className="mt-1 text-[13px] text-white/25">We&apos;ll let you know when something happens.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) void markOneRead(n.id); }}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors cursor-pointer ${
                  n.read
                    ? "border-white/[0.06] bg-[#111]"
                    : "border-[#D4FF4F]/20 bg-[#D4FF4F]/5 hover:bg-[#D4FF4F]/8"
                }`}
              >
                <div
                  className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                    n.read ? "bg-white/10" : "bg-[#D4FF4F]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-white/50">
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-white/25">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className={`mt-0.5 text-[13px] leading-snug ${n.read ? "text-white/50" : "text-white"}`}>
                    {n.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
