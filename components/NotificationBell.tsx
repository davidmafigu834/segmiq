"use client";

import { Bell, ChevronLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatTimeAgo } from "@/lib/format";
import Link from "next/link";
import type { UserRole } from "@/types";

type NotificationRow = {
  id: string;
  type:
    | "NEW_LEAD"
    | "FOLLOW_UP_DUE"
    | "FOLLOW_UP_PREP"
    | "DEAL_WON"
    | "LEAD_FLAG"
    | "UNCONTACTED_MANAGER_ALERT"
    | "FB_TOKEN_EXPIRED"
    | "BACKFILL_COMPLETE"
    | "WHATSAPP_CONNECTION_ALERT";
  message: string;
  read: boolean;
  lead_id: string | null;
  client_id?: string | null;
  created_at: string;
};

const fetchOpts: RequestInit = { credentials: "same-origin" };

function countUnread(rows: NotificationRow[]) {
  return rows.filter((n) => !n.read).length;
}

export function NotificationBell({ initialUnread = 0, role }: { initialUnread?: number; role: UserRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUnreadCount(initialUnread);
  }, [initialUnread]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  async function loadNotifications() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/notifications?limit=15", fetchOpts);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(
          err.error ?? (res.status === 401 ? "Sign in to see notifications" : "Could not load notifications")
        );
        setItems([]);
        if (res.status === 401) setUnreadCount(0);
        return;
      }
      const data = (await res.json()) as { notifications?: NotificationRow[] };
      const list = data.notifications ?? [];
      setItems(list);
      setUnreadCount(countUnread(list));
    } catch {
      setLoadError("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    setOpen(true);
    await loadNotifications();
  }

  async function markAllRead() {
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/notifications/mark-read", { method: "POST", ...fetchOpts });
      if (res.ok) {
        router.refresh();
      } else {
        setLoadError("Could not mark as read. Try again.");
        await loadNotifications();
      }
    } catch {
      setLoadError("Could not mark as read. Try again.");
      await loadNotifications();
    }
  }

  function leadHref(n: NotificationRow): string {
    if (n.lead_id) {
      if (role === "SALESPERSON") return `/sales/call-now?lead=${n.lead_id}`;
      if (role === "CLIENT_MANAGER") return `/client/leads/pipeline?lead=${n.lead_id}`;
      return `/dashboard/leads?lead=${n.lead_id}`;
    }
    if (n.type === "FB_TOKEN_EXPIRED") {
      if (n.client_id && role === "SUPER_ADMIN") {
        return `/dashboard/clients/${n.client_id}/facebook`;
      }
      return "/dashboard/clients";
    }
    if (n.type === "BACKFILL_COMPLETE") {
      return "/dashboard/leads";
    }
    if (n.type === "WHATSAPP_CONNECTION_ALERT") {
      return "/client/settings/integrations/whatsapp";
    }
    if (role === "SALESPERSON") return "/sales/pipeline";
    if (role === "CLIENT_MANAGER") return "/client/leads";
    return "/dashboard/leads";
  }

  return (
    <div ref={ref} className="relative z-40 shrink-0">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void handleOpen())}
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span
            className="absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-sales-brand px-1 text-[10px] font-semibold leading-none text-sales-brand-text ring-2 ring-sales-bg"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-card md:absolute md:inset-auto md:right-0 md:top-11 md:h-auto md:max-h-[min(90vh,520px)] md:w-[360px] md:rounded-lg md:border md:border-border md:shadow-lg">
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 md:px-4">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-secondary hover:bg-surface-card-alt md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <h3 className="min-w-0 flex-1 font-display text-lg text-ink-primary">Notifications</h3>
            {unreadCount > 0 && !loading ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="shrink-0 text-xs text-ink-secondary hover:text-ink-primary"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto md:max-h-[480px]">
            {loading ? (
              <div className="py-8 text-center text-sm text-ink-tertiary">Loading…</div>
            ) : null}

            {loadError ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-[var(--danger-fg,theme(colors.red.600))]">{loadError}</p>
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-accent"
                  onClick={() => void loadNotifications()}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!loading && !loadError && items.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="mx-auto mb-3 h-8 w-8 text-ink-tertiary" strokeWidth={1.5} />
                <p className="text-sm text-ink-secondary">No notifications yet</p>
              </div>
            ) : null}

            {!loading && !loadError
              ? items.map((n) => (
                  <Link
                    key={n.id}
                    href={leadHref(n)}
                    onClick={() => setOpen(false)}
                    className={[
                      "block border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-card-alt",
                      !n.read ? "bg-accent/[0.04]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      {!n.read ? <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                      <div className={n.read ? "pl-[12px]" : ""}>
                        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">
                          {labelForType(n.type)}
                        </div>
                        <p className="text-sm leading-snug text-ink-primary">{n.message}</p>
                        <p className="mt-1 text-xs text-ink-tertiary">{formatTimeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </Link>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function labelForType(type: string): string {
  switch (type) {
    case "NEW_LEAD":
      return "New lead";
    case "WHATSAPP_MESSAGE":
      return "WhatsApp message";
    case "WHATSAPP_CONNECTION_ALERT":
      return "WhatsApp connection";
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
    case "FB_TOKEN_EXPIRED":
      return "Facebook issue";
    case "BACKFILL_COMPLETE":
      return "Backfill complete";
    default:
      return type.replace(/_/g, " ").toLowerCase();
  }
}
