/**
 * CSRF / origin check for sensitive account-security mutations.
 * SameSite=lax cookies alone are not enough for all browsers/contexts.
 */

function hostFromUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withScheme).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Explicit app hosts only — never trust arbitrary *.APP_DOMAIN siblings. */
export function getAllowedAuthHosts(): Set<string> {
  const hosts = new Set<string>();
  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "segmiq.com")
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();

  for (const key of [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const h = hostFromUrl(key);
    if (h) hosts.add(h);
  }

  const extra = process.env.AUTH_ALLOWED_ORIGINS ?? process.env.AUTH_ALLOWED_HOSTS ?? "";
  for (const part of extra.split(/[,\s]+/)) {
    const h = hostFromUrl(part.trim());
    if (h) hosts.add(h);
  }

  // Known product hosts under the configured apex (not every subdomain).
  if (appDomain) {
    hosts.add(appDomain);
    hosts.add(`www.${appDomain}`);
    hosts.add(`cloud.${appDomain}`);
    hosts.add(`app.${appDomain}`);
    hosts.add(`dashboard.${appDomain}`);
  }

  return hosts;
}

export function assertBrowserOrigin(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host")?.toLowerCase();
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
    const originHost = new URL(origin).host.toLowerCase();
    if (originHost === host) return { ok: true };

    const allowed = getAllowedAuthHosts();
    if (allowed.has(originHost) && allowed.has(host)) {
      return { ok: true };
    }

    return { ok: false, status: 403, error: "Invalid origin" };
  } catch {
    return { ok: false, status: 403, error: "Invalid origin" };
  }
}
