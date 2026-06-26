import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { NotificationRow } from "./notification-types";

const CHANNEL_ID = "segmiq-leads";

let channelReady = false;
let permissionGranted = false;

function notificationIdFromUuid(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147480000 || 1;
}

function labelForType(type: string): string {
  switch (type) {
    case "NEW_LEAD":
      return "New lead";
    case "FOLLOW_UP_DUE":
      return "Follow-up due";
    case "DEAL_WON":
      return "Deal won";
    default:
      return "Segmiq";
  }
}

export async function initLocalNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const perm = await LocalNotifications.requestPermissions();
    permissionGranted = perm.display === "granted";

    if (!channelReady) {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: "Lead alerts",
        description: "New leads and follow-up reminders",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
      });
      channelReady = true;
    }

    return permissionGranted;
  } catch {
    return false;
  }
}

export async function showTrayNotification(notification: NotificationRow): Promise<void> {
  if (!Capacitor.isNativePlatform() || !permissionGranted) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdFromUuid(notification.id),
          title: labelForType(notification.type),
          body: notification.message,
          channelId: CHANNEL_ID,
          sound: "default",
          extra: {
            leadId: notification.lead_id ?? "",
            notificationId: notification.id,
          },
        },
      ],
    });
  } catch {
    /* ignore */
  }
}

export function onNotificationTapped(
  handler: (payload: { leadId?: string; notificationId?: string }) => void
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  const sub = LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const extra = event.notification.extra as
      | { leadId?: string; notificationId?: string }
      | undefined;
    handler({
      leadId: extra?.leadId || undefined,
      notificationId: extra?.notificationId || undefined,
    });
  });

  return () => {
    void sub.then((h) => h.remove());
  };
}

export function isTrayNotificationsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
