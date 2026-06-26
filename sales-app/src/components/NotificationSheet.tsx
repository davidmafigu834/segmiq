import { useEffect, useState } from "react";
import { Bell, ChevronLeft, Loader2, X } from "lucide-react";
import {
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  notificationTypeLabel,
} from "../lib/notifications-api";
import type { NotificationRow } from "../lib/notification-types";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenLead: (leadId: string) => void;
  onRefresh?: () => void;
};

export function NotificationSheet({ open, onClose, onOpenLead, onRefresh }: Props) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchNotifications(30);
        if (!cancelled) setItems(data.notifications);
      } catch {
        if (!cancelled) {
          setError("Could not load notifications");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      onRefresh?.();
    } catch {
      setError("Could not mark as read");
    }
  }

  function handleItemClick(n: NotificationRow) {
    onClose();
    if (n.lead_id) onOpenLead(n.lead_id);
  }

  if (!open) return null;

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg-primary safe-top">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary touch-manipulation active:bg-bg-tertiary"
          aria-label="Close"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="min-w-0 flex-1 font-display text-[20px] text-ink-primary">Notifications</h2>
        {unread > 0 && !loading ? (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="shrink-0 text-[13px] font-medium text-accent touch-manipulation"
          >
            Mark all read
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary md:hidden"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : null}

        {error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] text-[var(--error)]">{error}</p>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-ink-tertiary" strokeWidth={1.5} />
            <p className="text-[15px] text-ink-secondary">No notifications yet</p>
            <p className="mt-1 text-[13px] text-ink-tertiary">
              New leads and follow-ups will appear here
            </p>
          </div>
        ) : null}

        {!loading && !error
          ? items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItemClick(n)}
                className={[
                  "flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left touch-manipulation active:bg-bg-tertiary",
                  !n.read ? "bg-accent-muted/30" : "",
                ].join(" ")}
              >
                {!n.read ? (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
                ) : (
                  <span className="mt-2 w-2 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
                    {notificationTypeLabel(n.type)}
                  </p>
                  <p className="text-[15px] leading-snug text-ink-primary">{n.message}</p>
                  <p className="mt-1.5 text-[12px] text-ink-tertiary">
                    {formatNotificationTime(n.created_at)}
                  </p>
                </div>
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
