import { useEffect, useState } from "react";
import { Volume2, VolumeX, Smartphone } from "lucide-react";
import { CrmCard } from "./crm";
import {
  getNotificationPrefs,
  setNotificationSoundEnabled,
  setNotificationTone,
  setNotificationTrayEnabled,
  type NotificationPrefs,
} from "../lib/notification-prefs";
import { NOTIFICATION_TONE_OPTIONS, type NotificationTone } from "../lib/notification-types";
import { playNotificationTone, primeAudioContext } from "../lib/notification-sounds";
import { isTrayNotificationsAvailable } from "../lib/local-notifications";

export function NotificationToneSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [previewing, setPreviewing] = useState<NotificationTone | null>(null);

  useEffect(() => {
    void getNotificationPrefs().then(setPrefs);
  }, []);

  async function updateTone(tone: NotificationTone) {
    await setNotificationTone(tone);
    setPrefs((p) => (p ? { ...p, tone } : p));
    setPreviewing(tone);
    primeAudioContext();
    await playNotificationTone(tone);
    window.setTimeout(() => setPreviewing(null), 600);
  }

  async function toggleSound() {
    if (!prefs) return;
    const next = !prefs.soundEnabled;
    await setNotificationSoundEnabled(next);
    setPrefs({ ...prefs, soundEnabled: next });
    if (next) {
      primeAudioContext();
      await playNotificationTone(prefs.tone === "silent" ? "default" : prefs.tone);
    }
  }

  async function toggleTray() {
    if (!prefs) return;
    const next = !prefs.trayEnabled;
    await setNotificationTrayEnabled(next);
    setPrefs({ ...prefs, trayEnabled: next });
  }

  if (!prefs) {
    return <div className="h-32 animate-pulse rounded-xl bg-bg-tertiary" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-2">Alert tone</p>
        <p className="mb-3 text-[13px] text-ink-tertiary">
          Pick a sound so new leads and follow-ups are never missed
        </p>
        <div className="grid grid-cols-2 gap-2">
          {NOTIFICATION_TONE_OPTIONS.map((opt) => {
            const active = prefs.tone === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => void updateTone(opt.id)}
                className={`rounded-xl border px-3 py-3 text-left touch-manipulation transition-colors ${
                  active
                    ? "border-accent bg-accent-muted"
                    : "border-border bg-surface-card active:bg-bg-tertiary"
                }`}
              >
                <p
                  className={`text-[14px] font-semibold ${active ? "text-accent" : "text-ink-primary"}`}
                >
                  {opt.label}
                  {previewing === opt.id ? " · …" : null}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-tertiary">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <CrmCard className="divide-y divide-border overflow-hidden">
        <button
          type="button"
          onClick={() => void toggleSound()}
          className="flex w-full items-center justify-between gap-3 p-4 text-left touch-manipulation active:bg-bg-tertiary"
        >
          <div className="flex items-center gap-3">
            {prefs.soundEnabled ? (
              <Volume2 size={18} className="text-accent" />
            ) : (
              <VolumeX size={18} className="text-ink-tertiary" />
            )}
            <div>
              <p className="font-medium text-ink-primary">In-app sound</p>
              <p className="text-[12px] text-ink-tertiary">Play tone when a new alert arrives</p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${
              prefs.soundEnabled
                ? "bg-accent-muted text-accent"
                : "bg-bg-tertiary text-ink-tertiary"
            }`}
          >
            {prefs.soundEnabled ? "On" : "Off"}
          </span>
        </button>

        {isTrayNotificationsAvailable() ? (
          <button
            type="button"
            onClick={() => void toggleTray()}
            className="flex w-full items-center justify-between gap-3 p-4 text-left touch-manipulation active:bg-bg-tertiary"
          >
            <div className="flex items-center gap-3">
              <Smartphone size={18} className="text-accent" />
              <div>
                <p className="font-medium text-ink-primary">Phone notifications</p>
                <p className="text-[12px] text-ink-tertiary">Show alerts in the notification tray</p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${
                prefs.trayEnabled
                  ? "bg-accent-muted text-accent"
                  : "bg-bg-tertiary text-ink-tertiary"
              }`}
            >
              {prefs.trayEnabled ? "On" : "Off"}
            </span>
          </button>
        ) : null}
      </CrmCard>
    </div>
  );
}
