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
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 lg:px-8">
      <div className="mx-auto max-w-xl">
        {unread > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[12px] text-[#6B7280] font-cloud-body">{unread} unread</p>
            <button
              onClick={() => void markAllRead()}
              disabled={markingAll}
              className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#666660] hover:border-black/[0.15] hover:text-[#0a0a0a] transition-colors disabled:opacity-50 font-cloud-body"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[#0a0a0a]/20" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-black/[0.07]">
              <Bell className="h-6 w-6 text-[#6B7280]" strokeWidth={1.5} />
            </div>
            <p className="font-cloud-display text-[18px] text-[#0a0a0a] mb-1">No notifications yet</p>
            <p className="text-[13px] text-[#6B7280] font-cloud-body">We&apos;ll let you know when something happens.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) void markOneRead(n.id); }}
                className={`flex items-start gap-3 rounded-[20px] border px-4 py-4 transition-all cursor-pointer active:scale-[0.99] ${
                  n.read
                    ? "border-black/[0.07] bg-white"
                    : "border-[#C4A8FF]/30 bg-gradient-to-br from-[#F5F0FF] via-[#EDE5FF] to-[#DDD0FF]"
                }`}
              >
                <div
                  className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                    n.read ? "bg-black/10" : "bg-[#7B5EA7]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-semibold font-cloud-body ${n.read ? "text-[#6B7280]" : "text-[#7B5EA7]"}`}>
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="flex-shrink-0 text-[11px] font-cloud-body text-[#8C7B6B]">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className={`mt-0.5 text-[13px] leading-snug font-cloud-body ${n.read ? "text-[#666660]" : "text-[#2D1B6B]"}`}>
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
