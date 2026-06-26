import type { NotificationTone } from "./notification-types";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume = 0.25
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export async function playNotificationTone(tone: NotificationTone): Promise<void> {
  if (tone === "silent") return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;

  switch (tone) {
    case "default":
      playTone(ctx, 880, t, 0.12);
      playTone(ctx, 1175, t + 0.14, 0.18);
      break;
    case "urgent":
      playTone(ctx, 980, t, 0.1, 0.3);
      playTone(ctx, 980, t + 0.16, 0.1, 0.3);
      playTone(ctx, 980, t + 0.32, 0.14, 0.35);
      break;
    case "chime":
      playTone(ctx, 523, t, 0.15);
      playTone(ctx, 659, t + 0.12, 0.15);
      playTone(ctx, 784, t + 0.24, 0.22);
      break;
    case "bell":
      playTone(ctx, 740, t, 0.08, 0.28);
      playTone(ctx, 554, t + 0.06, 0.35, 0.22);
      playTone(ctx, 440, t + 0.2, 0.5, 0.15);
      break;
    case "pulse":
      for (let i = 0; i < 4; i++) {
        playTone(ctx, 620, t + i * 0.22, 0.12, 0.28);
      }
      break;
    default:
      playTone(ctx, 880, t, 0.12);
      playTone(ctx, 1175, t + 0.14, 0.18);
  }
}

export function primeAudioContext(): void {
  void getAudioContext()?.resume();
}
