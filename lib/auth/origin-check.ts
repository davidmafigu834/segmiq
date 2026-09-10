/**
 * CSRF / origin check for sensitive account-security mutations.
 * SameSite=lax cookies alone are not enough for all browsers/contexts.
 */

function isConfiguredAppHost(hostname: string, appDomain: string): boolean {
  return hostname === appDomain || hostname.endsWith(`.${appDomain}`);
}

export function assertBrowserOrigin(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) {
    // Non-browser clients (mobile Bearer) may omit Origin — allow when Authorization Bearer present.
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) return { ok: true };
    // Same-origin navigations / some fetches may omit Origin; require Sec-Fetch-Site when present.
    const site = req.headers.get("sec-fetch-site");
    if (site === "same-origin" || site === "none") return { ok: true };
    return { ok: false, status: 403, error: "Missing origin" };
  }
  if (!host) {
    return { ok: false, status: 403, error: "Missing host" };
  }
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return { ok: true };

    const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "segmiq.com")
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0];

    // Allow sibling app hosts (e.g. app.segmiq.com ↔ dashboard.segmiq.com), never arbitrary origins.
    if (isConfiguredAppHost(originHost, appDomain) && isConfiguredAppHost(host, appDomain)) {
      return { ok: true };
    }

    return { ok: false, status: 403, error: "Invalid origin" };
  } catch {
    return { ok: false, status: 403, error: "Invalid origin" };
  }
}
