import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import {
  getAlertedNotificationIds,
  getNotificationPrefs,
  markNotificationAlerted,
} from "../lib/notification-prefs";
import { initLocalNotifications, onNotificationTapped, showTrayNotification } from "../lib/local-notifications";
import { fetchNotifications } from "../lib/notifications-api";
import { playNotificationTone, primeAudioContext } from "../lib/notification-sounds";
import type { NotificationRow } from "../lib/notification-types";

const POLL_MS = 45_000;

type Options = {
  enabled: boolean;
  online: boolean;
  onOpenLead?: (leadId: string) => void;
};

export function useNotificationAlerts({ enabled, online, onOpenLead }: Options) {
  const [unreadCount, setUnreadCount] = useState(0);
  const alertedRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const baselineSeededRef = useRef(false);

  const poll = useCallback(async () => {
    if (!enabled || !online) return;

    try {
      const { notifications, unreadCount: count } = await fetchNotifications(25);
      setUnreadCount(count);

      if (!baselineSeededRef.current) {
        baselineSeededRef.current = true;
        for (const n of notifications) {
          alertedRef.current.add(n.id);
          await markNotificationAlerted(n.id, alertedRef.current);
        }
        return;
      }

      const prefs = await getNotificationPrefs();
      const newUnread = notifications.filter((n) => !n.read && !alertedRef.current.has(n.id));

      for (const n of newUnread) {
        if (prefs.soundEnabled && prefs.tone !== "silent") {
          await playNotificationTone(prefs.tone);
        }
        if (prefs.trayEnabled) {
          await showTrayNotification(n);
        }
        await markNotificationAlerted(n.id, alertedRef.current);
        alertedRef.current.add(n.id);
      }
    } catch {
      /* ignore polling errors */
    }
  }, [enabled, online]);

  useEffect(() => {
    if (!enabled) return;

    void getAlertedNotificationIds().then((ids) => {
      alertedRef.current = ids;
    });

    if (!initializedRef.current) {
      initializedRef.current = true;
      void initLocalNotifications();
    }

    primeAudioContext();
    void poll();

    const interval = window.setInterval(() => void poll(), POLL_MS);
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void poll();
    });

    const removeTap = onNotificationTapped(({ leadId }) => {
      if (leadId && onOpenLead) onOpenLead(leadId);
    });

    return () => {
      window.clearInterval(interval);
      void sub.then((h) => h.remove());
      removeTap();
    };
  }, [enabled, poll, onOpenLead]);

  const refresh = useCallback(async () => {
    if (!enabled || !online) return;
    try {
      const { unreadCount: count } = await fetchNotifications(5);
      setUnreadCount(count);
    } catch {
      /* ignore */
    }
  }, [enabled, online]);

  return { unreadCount, refresh, poll };
}

export type { NotificationRow };
