/**
 * Phase 6 browser security headers.
 * CSP starts in Report-Only by default (CSP_ENFORCE=true to enforce).
 */

const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "segmiq.com")
  .replace(/^https?:\/\//i, "")
  .split("/")[0]
  .split(":")[0];

function r2ConnectSrc(): string {
  const raw = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim();
  if (!raw) return "https://*.r2.dev https://*.r2.cloudflarestorage.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.r2.dev https://*.r2.cloudflarestorage.com";
  }
}

function supabaseConnectSrc(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "https://*.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

/**
 * Practical CSP for Next.js App Router.
 * Allows Next inline bootstrap; tighten further once nonces are wired app-wide.
 */
export function buildContentSecurityPolicy(): string {
  const connect = [
    "'self'",
    supabaseConnectSrc(),
    r2ConnectSrc(),
    "https://graph.facebook.com",
    "https://www.facebook.com",
    `https://*.${APP_DOMAIN}`,
    `https://${APP_DOMAIN}`,
  ].join(" ");

  const img = [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://*.fbcdn.net",
    "https://scontent.xx.fbcdn.net",
    r2ConnectSrc(),
    "https://images.unsplash.com",
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // Next.js requires 'unsafe-inline' for some styles; scripts use 'unsafe-inline' until nonce rollout.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "report-uri /api/security/csp-report",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()";

export function securityHeaderList(): Array<{ key: string; value: string }> {
  const isProd = process.env.NODE_ENV === "production";
  const enforceCsp = process.env.CSP_ENFORCE === "true";
  const csp = buildContentSecurityPolicy();

  const headers: Array<{ key: string; value: string }> = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    {
      key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: csp,
    },
  ];

  if (isProd) {
    // No preload — deliberate (Phase 6). includeSubDomains only when APP domain is fully HTTPS.
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}
