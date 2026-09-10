/**
 * Friendly session / device labels from UA + session_type metadata.
 * No invasive fingerprinting; graceful fallbacks.
 */

export type SessionLabelParts = {
  browser: string;
  os: string;
  deviceName: string;
};

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/SegmiQ/i.test(ua) || /Segmiq/i.test(ua)) return "SegmiQ";
  return "Unknown browser";
}

function detectOs(ua: string): string {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown OS";
}

export function labelSessionDevice(input: {
  sessionType?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
  metadata?: Record<string, unknown> | null;
}): SessionLabelParts {
  const stored = input.deviceName?.trim();
  if (stored) {
    return { browser: stored, os: "", deviceName: stored };
  }

  const channel =
    typeof input.metadata?.channel === "string" ? input.metadata.channel : null;
  const ua = input.userAgent?.trim() || "";

  if (input.sessionType === "MOBILE" || channel === "sales_app" || channel === "cloud_app") {
    const os = ua ? detectOs(ua) : "Android";
    const app =
      channel === "cloud_app"
        ? "SegmiQ Cloud App"
        : channel === "sales_app"
          ? "SegmiQ Sales App"
          : /cloud/i.test(ua)
            ? "SegmiQ Cloud App"
            : "SegmiQ Sales App";
    return {
      browser: app,
      os,
      deviceName: `${app} on ${os}`,
    };
  }

  if (!ua) {
    return {
      browser: "Unknown browser",
      os: "Unknown OS",
      deviceName: "SegmiQ session",
    };
  }

  const browser = detectBrowser(ua);
  const os = detectOs(ua);
  return {
    browser,
    os,
    deviceName: `${browser} on ${os}`,
  };
}

export function formatRelativeActive(lastSeenAt: string, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - new Date(lastSeenAt).getTime());
  if (delta < 2 * 60_000) return "Active now";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `Last active ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Last active ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Last active ${days} day${days === 1 ? "" : "s"} ago`;
}
