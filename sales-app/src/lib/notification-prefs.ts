import { Preferences } from "@capacitor/preferences";
import type { NotificationTone } from "./notification-types";

const TONE_KEY = "segmiq_sales_notification_tone";
const SOUND_ENABLED_KEY = "segmiq_sales_notification_sound";
const TRAY_ENABLED_KEY = "segmiq_sales_notification_tray";
const ALERTED_IDS_KEY = "segmiq_sales_alerted_notification_ids";

export type NotificationPrefs = {
  tone: NotificationTone;
  soundEnabled: boolean;
  trayEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  tone: "urgent",
  soundEnabled: true,
  trayEnabled: true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const [tone, sound, tray] = await Promise.all([
    Preferences.get({ key: TONE_KEY }),
    Preferences.get({ key: SOUND_ENABLED_KEY }),
    Preferences.get({ key: TRAY_ENABLED_KEY }),
  ]);

  const toneVal = tone.value as NotificationTone | null;
  const validTones: NotificationTone[] = [
    "default",
    "urgent",
    "chime",
    "bell",
    "pulse",
    "silent",
  ];

  return {
    tone: toneVal && validTones.includes(toneVal) ? toneVal : DEFAULT_PREFS.tone,
    soundEnabled: sound.value !== "false",
    trayEnabled: tray.value !== "false",
  };
}

export async function setNotificationTone(tone: NotificationTone): Promise<void> {
  await Preferences.set({ key: TONE_KEY, value: tone });
}

export async function setNotificationSoundEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: SOUND_ENABLED_KEY, value: enabled ? "true" : "false" });
}

export async function setNotificationTrayEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: TRAY_ENABLED_KEY, value: enabled ? "true" : "false" });
}

export async function getAlertedNotificationIds(): Promise<Set<string>> {
  const { value } = await Preferences.get({ key: ALERTED_IDS_KEY });
  if (!value) return new Set();
  try {
    const parsed = JSON.parse(value) as string[];
    return new Set(Array.isArray(parsed) ? parsed.slice(-200) : []);
  } catch {
    return new Set();
  }
}

export async function markNotificationAlerted(id: string, existing: Set<string>): Promise<void> {
  const next = new Set(existing);
  next.add(id);
  const arr = [...next].slice(-200);
  await Preferences.set({ key: ALERTED_IDS_KEY, value: JSON.stringify(arr) });
}

export async function clearAlertedNotificationIds(): Promise<void> {
  await Preferences.remove({ key: ALERTED_IDS_KEY });
}
