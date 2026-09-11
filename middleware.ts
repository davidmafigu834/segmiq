import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { homeForRole } from "@/lib/auth/impersonation";
import { isSuperAdminRole, normalizeUserRole } from "@/lib/auth/roles";
import { isMfaRestrictedAllowlistedPath } from "@/lib/auth/mfa/allowlist";
import {
  fetchMiddlewareCrmSubscriptionStatus,
  fetchMiddlewareSessionAlive,
  fetchMiddlewareSessionVersion,
} from "@/lib/supabase/middleware-admin";
import type { ClientMode, UserRole } from "@/types";

export async function middleware(req: NextRequest) {
  const hostHeader = req.headers.get("host") || "";
  const host = hostHeader.split(":")[0];
  const appDomain = (
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    hostHeader ||
    "localhost:3000"
  )
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0];

  const isCloudSubdomain =
    host === `cloud.${appDomain}` ||
    host === "cloud.segmiq.com" ||
    host === "cloud.localhost";
  const isBlogSubdomain = host === "blog.segmiq.com" || host.startsWith("blog.localhost");

  // Phase 6.2 — API MFA enrolment gate (matcher includes /api/*).
  // Does not redirect unauthenticated APIs; only blocks restricted sessions.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return enforceApiMfaEnrolmentGate(req);
  }

  // Blog subdomain: rewrite to internal /blog/* (public URLs have no /blog prefix)
  if (isBlogSubdomain) {
    const path = req.nextUrl.pathname;
    if (!path.startsWith("/blog")) {
      const url = req.nextUrl.clone();
      url.pathname = `/blog${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Local dev on localhost:3000/blog — article links are root-relative (`/<slug>`) like
  // production blog.segmiq.com, but without this rewrite they hit auth and redirect to /login.
  const path = req.nextUrl.pathname;
  const isLocalDevHost = host === "localhost" || host.endsWith(".localhost");
  if (isLocalDevHost && !isCloudSubdomain && !path.startsWith("/blog")) {
    const blogDevPath = localBlogDevRewrite(path);
    if (blogDevPath) {
      const url = req.nextUrl.clone();
      url.pathname = blogDevPath;
      return NextResponse.rewrite(url);
    }
  }

  // Redirect old blog URLs on the production main host to blog.segmiq.com.
  // Local dev: use localhost:3000/blog or blog.localhost:3000 (no redirect).
  const isProductionMain =
    host === "segmiq.com" ||
    host === "www.segmiq.com" ||
    (host === appDomain && host !== "localhost" && !host.endsWith(".localhost")) ||
    host === `www.${appDomain}`;
  if (isProductionMain) {
    const path = req.nextUrl.pathname;
    if (path === "/blog" || path.startsWith("/blog/")) {
      const rest = path.replace(/^\/blog/, "");
      return NextResponse.redirect(`https://blog.segmiq.com${rest || "/"}${req.nextUrl.search}`, 301);
    }
  }

  if (isCloudSubdomain) {
    const path = req.nextUrl.pathname;

    if (path.startsWith("/downloads/") || path.endsWith(".apk")) {
      return NextResponse.next();
    }

    const cloudEntryRedirect = await redirectIfAuthenticatedCloudEntry(req, path, true);
    if (cloudEntryRedirect) return cloudEntryRedirect;

    // Map known URL paths to internal routes.
    // IMPORTANT: only rewrite explicit cloud routes — do NOT catch static files
    // like /manifest.json, /sw.js, /icons/* (those must be served as-is).
    const profileRewrite = cloudPublicProfileRewrite(path);
    let cloudPath: string | null = profileRewrite;
    if (!cloudPath) {
      if (path === "/") {
        cloudPath = "/cloud";
      } else if (
        path === "/login" ||
        path === "/signup" ||
        path === "/forgot-password" ||
        path === "/reset-password" ||
        path === "/help" ||
        path.startsWith("/dashboard") ||
        path.startsWith("/share/")
      ) {
        cloudPath = "/cloud" + path;
      }
    }
    // /manifest.json, /sw.js, /icons/*, /api/*, etc. pass through unchanged

    // Resolved internal path for auth checks
    const resolved = cloudPath ?? path;

    // Public cloud paths — no auth required
    const isCloudPublic = isCloudPublicPath(resolved);

    if (!isCloudPublic) {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = "/login"; // cloud subdomain will rewrite this to /cloud/login
        url.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(url);
      }
      const tokenSv = Number((token as { sessionVersion?: number }).sessionVersion ?? 0);
      const effectiveUserId = (token as { userId?: string }).userId;
      const realUserId = (token as { realUserId?: string | null }).realUserId ?? null;
      const uid = realUserId ?? effectiveUserId;
      const sessionId = (token as { sessionId?: string | null }).sessionId ?? null;
      const role = (normalizeUserRole(token.role as string) ?? (token.role as UserRole)) as UserRole;
      const staleSession = await staleSessionRedirect(
        req,
        uid,
        tokenSv,
        sessionId,
        role,
        effectiveUserId ?? uid
      );
      if (staleSession) return staleSession;
    }

    // Rewrite to the internal /cloud/* path — this avoids app/page.tsx running
    if (cloudPath) {
      const url = req.nextUrl.clone();
      url.pathname = cloudPath;
      const response = NextResponse.rewrite(url);
      response.headers.set("x-pathname", path);
      return response;
    }

    const response = NextResponse.next();
    response.headers.set("x-pathname", path);
    return response;
  }

  if (!isCloudSubdomain && host && host !== appDomain && host.endsWith("." + appDomain)) {
    const slug = host.slice(0, -(appDomain.length + 1));
    if (slug && slug !== "www") {
      const url = req.nextUrl.clone();
      url.pathname = `/p/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  // Root route: show landing page for guests; redirect authenticated users to their dashboard
  if (path === "/") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      const role = (normalizeUserRole(token.role as string) ?? (token.role as UserRole)) as UserRole;
      const clientMode = (token as { clientMode?: ClientMode }).clientMode ?? "team";
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/facebook/webhook")) return NextResponse.next();
  if (path.startsWith("/api/leads/submit")) return NextResponse.next();
  if (path.startsWith("/api/leads/magic/")) return NextResponse.next();
  if (path.startsWith("/api/onboard/")) return NextResponse.next();
  if (path.startsWith("/api/proposals/")) return NextResponse.next();
  if (path.startsWith("/api/quotes/")) return NextResponse.next();
  if (path.startsWith("/api/cron/")) {
    const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const cronSecret = process.env.CRON_SECRET;
    const allowInsecureDev =
      process.env.NODE_ENV === "development" && process.env.ALLOW_INSECURE_CRON === "true";
    if ((cronSecret && secret === cronSecret) || allowInsecureDev) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const marketingPublic =
    path === "/" ||
    path === "/why-segmiq" ||
    path === "/security" ||
    path === "/products/segmiq-crm" ||
    path === "/features" ||
    path === "/pricing" ||
    path.startsWith("/solutions/") ||
    path === "/contact" ||
    path === "/partners" ||
    path === "/careers" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/status" ||
    path.startsWith("/legal/");

  const isPublic =
    path === "/login" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/lead/") ||
    path.startsWith("/onboard/") ||
    path.startsWith("/proposal/") ||
    path.startsWith("/quote/") ||
    path.startsWith("/l/") ||
    path.startsWith("/d/") ||
    path.startsWith("/p/") ||
    path.startsWith("/f/") ||
    path === "/cloud" ||
    path === "/cloud/login" ||
    path === "/cloud/signup" ||
    path === "/cloud/forgot-password" ||
    path === "/cloud/reset-password" ||
    path.startsWith("/cloud/share/") ||
    path === "/blog" ||
    path.startsWith("/blog/");

  if (marketingPublic || isPublic) {
    const cloudEntryRedirect = await redirectIfAuthenticatedCloudEntry(req, path, false);
    if (cloudEntryRedirect) return cloudEntryRedirect;
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  const tokenSv = Number((token as { sessionVersion?: number }).sessionVersion ?? 0);
  const effectiveUserId = (token as { userId?: string }).userId;
  const realUserId = (token as { realUserId?: string | null }).realUserId ?? null;
  // session_version is checked against the real admin when impersonating.
  const uid = realUserId ?? effectiveUserId;
  const sessionId = (token as { sessionId?: string | null }).sessionId ?? null;
  const role = (normalizeUserRole(token.role as string) ?? (token.role as UserRole)) as UserRole;
  const clientMode = (token as { clientMode?: ClientMode }).clientMode ?? "team";
  const alsoSells = Boolean((token as { alsoSells?: boolean }).alsoSells);
  const isImpersonating = Boolean(realUserId);
  const cid = (token as { clientId?: string | null }).clientId;
  const mfaEnrolmentRequired = Boolean(
    (token as { mfaEnrolmentRequired?: boolean }).mfaEnrolmentRequired
  );
  // Restricted MFA sessions may only reach enrolment / recovery surfaces.
  if (mfaEnrolmentRequired && !isMfaEnrolmentPageAllowed(path, role)) {
    return NextResponse.redirect(new URL(mfaEnrolmentPageForRole(role), req.url));
  }
  const isGatedRole = role === "CLIENT_MANAGER" || role === "SALESPERSON";
  const gateExempt =
    path === "/client/blocked" ||
    path === "/sales/blocked" ||
    path === "/solo/blocked" ||
    path === "/client/billing" ||
    path.startsWith("/client/billing/") ||
    path === "/solo/billing" ||
    path.startsWith("/solo/billing/");
  const needBilling = isGatedRole && !isImpersonating && !gateExempt && Boolean(cid);

  const sessionOwnerId = effectiveUserId ?? uid;
  const [dbSv, sessionAlive, subStatus] = await Promise.all([
    uid ? fetchMiddlewareSessionVersion(uid) : Promise.resolve(null),
    sessionOwnerId && sessionId
      ? fetchMiddlewareSessionAlive(sessionId, String(sessionOwnerId), role)
      : Promise.resolve(uid ? false : null),
    needBilling && cid ? fetchMiddlewareCrmSubscriptionStatus(cid) : Promise.resolve(null),
  ]);

  // Fail closed: if session_version cannot be loaded, treat the session as expired.
  if (uid && (dbSv === null || dbSv !== tokenSv)) {
    return sessionExpiredRedirect(req);
  }
  // JWT alone is not enough — idle / revoked / missing user_sessions must force re-login.
  // Otherwise settings pages render while /api/auth/mfa returns Unauthorized.
  if (uid && sessionAlive !== true) {
    return sessionExpiredRedirect(req);
  }

  if (path.startsWith("/dashboard")) {
    if (!isSuperAdminRole(role) || isImpersonating) {
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
  }
  if (path.startsWith("/client")) {
    const isTeamPreview =
      !isImpersonating &&
      isSuperAdminRole(role) &&
      (path === "/client/team" || path.startsWith("/client/team/")) &&
      req.nextUrl.searchParams.has("clientId");
    if (!isTeamPreview && role !== "CLIENT_MANAGER") {
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
  }
  if (path.startsWith("/solo")) {
    if (role !== "SALESPERSON" || clientMode !== "solo") {
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
  }
  if (path.startsWith("/sales")) {
    const canAccessSales = role === "SALESPERSON" || (role === "CLIENT_MANAGER" && alsoSells);
    if (!canAccessSales) {
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
    if (clientMode === "solo" && (path === "/sales/dashboard" || path.startsWith("/sales/dashboard/"))) {
      return NextResponse.redirect(new URL("/solo/dashboard", req.url));
    }
  }

  // Billing access gate. A suspended subscription locks manager and salespeople
  // out of their portals. Exempt blocked screens and billing pages so clients can
  // pay and upload proof. Agency admins impersonating bypass the gate for support.
  // A timed-out or failed read fails open so Edge middleware cannot hang.
  if (needBilling && subStatus === "suspended") {
    if (role === "CLIENT_MANAGER") {
      if (alsoSells && path.startsWith("/sales")) {
        return NextResponse.redirect(new URL("/sales/blocked", req.url));
      }
      return NextResponse.redirect(new URL("/client/blocked", req.url));
    }
    if (role === "SALESPERSON" && clientMode === "solo") {
      return NextResponse.redirect(new URL("/solo/blocked", req.url));
    }
    return NextResponse.redirect(new URL("/sales/blocked", req.url));
  }

  return NextResponse.next();
}

/** First path segment on cloud.segmiq.com that is not a client profile slug. */
const CLOUD_RESERVED_SEGMENTS = new Set([
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "dashboard",
  "share",
  "help",
  "cloud",
  "downloads",
  "api",
  "p",
  "f",
  "lead",
  "quote",
  "proposal",
  "onboard",
  "l",
  "d",
  "blog",
  "_next",
]);

function sessionExpiredRedirect(req: NextRequest): NextResponse {
  const signOut = new URL("/api/auth/signout", req.url);
  signOut.searchParams.set("callbackUrl", "/login?reason=session");
  return NextResponse.redirect(signOut);
}

function mfaEnrolmentPageForRole(role: UserRole | string): string {
  if (isSuperAdminRole(role)) return "/dashboard/settings?tab=account&enrollMfa=1";
  if (role === "SALESPERSON") return "/sales/profile";
  return "/client/settings/security";
}

function isMfaEnrolmentPageAllowed(path: string, role: UserRole | string): boolean {
  if (path === "/login" || path === "/forgot-password" || path === "/reset-password") return true;
  if (path.startsWith("/client/settings")) return true;
  if (path === "/sales/profile" || path.startsWith("/sales/profile/")) return true;
  if (path.startsWith("/dashboard/settings")) return true;
  if (path === "/client/blocked" || path === "/sales/blocked" || path === "/solo/blocked") return true;
  if (path.startsWith("/client/billing") || path.startsWith("/solo/billing")) return true;
  // Allow landing on the role home redirect target only when it is the enrol page.
  const enrol = mfaEnrolmentPageForRole(role).split("?")[0]!;
  return path === enrol || path.startsWith(enrol + "/");
}

function isPublicApiPath(path: string): boolean {
  if (path.startsWith("/api/auth")) return true;
  if (path.startsWith("/api/facebook/webhook")) return true;
  if (path.startsWith("/api/leads/submit")) return true;
  if (path.startsWith("/api/leads/magic/")) return true;
  if (path.startsWith("/api/onboard/")) return true;
  if (path.startsWith("/api/proposals/")) return true;
  if (path.startsWith("/api/quotes/")) return true;
  if (path.startsWith("/api/public/")) return true;
  if (path.startsWith("/api/cron/")) return true;
  if (path.startsWith("/api/security/csp-report")) return true;
  if (path.startsWith("/api/whatsapp/gateway")) return true;
  return false;
}

function mfaEnrolmentDeniedApi(): NextResponse {
  return NextResponse.json(
    {
      error: "MFA_ENROLMENT_REQUIRED",
      message: "Complete two-step verification before using SegmiQ.",
      enrollPath: "/client/settings/security",
    },
    { status: 403 }
  );
}

/**
 * Edge gate for cookie + Bearer sessions that still require MFA enrolment.
 * Unauthenticated requests pass through so route handlers return their own 401.
 */
async function enforceApiMfaEnrolmentGate(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname;
  if (isPublicApiPath(path) || isMfaRestrictedAllowlistedPath(path)) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Fail closed: without a signing secret we cannot validate MFA enrolment claims.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
    }
    console.warn("[middleware] NEXTAUTH_SECRET missing — MFA enrolment gate skipped in development");
    return NextResponse.next();
  }

  // next-auth getToken can throw on malformed Authorization (known advisory).
  // Fail closed for this gate only — do not take down the request pipeline.
  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    token = await getToken({ req, secret });
  } catch {
    token = null;
  }
  if (token && Boolean((token as { mfaEnrolmentRequired?: boolean }).mfaEnrolmentRequired)) {
    return mfaEnrolmentDeniedApi();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const raw = header.slice(7).trim();
    if (raw) {
      try {
        const { payload } = await jwtVerify(raw, new TextEncoder().encode(secret), {
          algorithms: ["HS256"],
        });
        if (Boolean(payload.mfaEnrolmentRequired)) {
          return mfaEnrolmentDeniedApi();
        }
      } catch {
        // Invalid bearer — leave to route auth.
      }
    }
  }

  return NextResponse.next();
}

async function staleSessionRedirect(
  req: NextRequest,
  uid: string | undefined,
  tokenSv: number,
  sessionId?: string | null,
  role?: UserRole | string,
  sessionOwnerId?: string | null
): Promise<NextResponse | null> {
  if (!uid) return null;
  const dbSv = await fetchMiddlewareSessionVersion(uid);
  // Fail closed: missing DB version → session expired (same as version mismatch).
  if (dbSv === null || dbSv !== tokenSv) {
    return sessionExpiredRedirect(req);
  }
  const owner = sessionOwnerId || uid;
  if (sessionId && role) {
    const alive = await fetchMiddlewareSessionAlive(sessionId, owner, role);
    if (alive !== true) return sessionExpiredRedirect(req);
  } else if (!sessionId) {
    return sessionExpiredRedirect(req);
  }
  return null;
}

function cloudDashboardPath(isCloudSubdomain: boolean): string {
  return isCloudSubdomain ? "/dashboard" : "/cloud/dashboard";
}

function isCloudMarketingEntryPath(path: string, isCloudSubdomain: boolean): boolean {
  if (isCloudSubdomain) {
    return path === "/" || path === "/login" || path === "/signup";
  }
  return path === "/cloud" || path === "/cloud/login" || path === "/cloud/signup";
}

/** Skip landing/login/signup when the user already has a Cloud session. */
async function redirectIfAuthenticatedCloudEntry(
  req: NextRequest,
  path: string,
  isCloudSubdomain: boolean
): Promise<NextResponse | null> {
  if (!isCloudMarketingEntryPath(path, isCloudSubdomain)) return null;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return null;

  const url = req.nextUrl.clone();
  const callback = url.searchParams.get("callbackUrl");
  const isLogin = path === "/login" || path === "/cloud/login";

  if (isLogin && callback && callback.startsWith("/") && !callback.startsWith("//")) {
    url.pathname = callback;
    url.searchParams.delete("callbackUrl");
  } else {
    url.pathname = cloudDashboardPath(isCloudSubdomain);
    url.search = "";
  }

  return NextResponse.redirect(url);
}

function isCloudPublicPath(resolved: string): boolean {
  return (
    resolved === "/cloud" ||
    resolved === "/cloud/login" ||
    resolved === "/cloud/signup" ||
    resolved === "/cloud/forgot-password" ||
    resolved === "/cloud/reset-password" ||
    resolved.startsWith("/cloud/share/") ||
    resolved.startsWith("/p/") ||
    resolved.startsWith("/f/") ||
    resolved.startsWith("/lead/") ||
    resolved.startsWith("/onboard/") ||
    resolved.startsWith("/proposal/") ||
    resolved.startsWith("/quote/") ||
    resolved.startsWith("/l/") ||
    resolved.startsWith("/d/")
  );
}

/** Map cloud.segmiq.com/{slug}/… public URLs to internal /p/* routes. */
function cloudPublicProfileRewrite(path: string): string | null {
  if (path === "/" || !path.startsWith("/")) return null;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const slug = segments[0]!;
  if (CLOUD_RESERVED_SEGMENTS.has(slug)) return null;

  if (segments.length === 1) {
    return `/p/${slug}`;
  }

  const second = segments[1]!;
  if (segments.length === 2 && second === "packages") {
    return `/p/${slug}/packages`;
  }

  if (segments.length === 2 && second === "projects") {
    return `/p/${slug}/projects`;
  }

  if (segments.length === 3 && second === "projects" && segments[2]) {
    return `/p/${slug}/projects/${segments[2]}`;
  }

  if (segments.length === 2 && second !== "p") {
    return `/p/${slug}/p/${second}`;
  }

  if (segments.length === 3 && second === "p" && segments[2]) {
    return `/p/${slug}/p/${segments[2]}`;
  }

  return null;
}

/** Map root-relative blog URLs to internal /blog/* when developing on localhost:3000/blog. */
function localBlogDevRewrite(path: string): string | null {
  if (path.startsWith("/blog")) return null;

  if (path.startsWith("/category/")) {
    return `/blog${path}`;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length !== 1) return null;

  const root = segments[0];
  const appRoots = new Set([
    "login",
    "forgot-password",
    "reset-password",
    "dashboard",
    "client",
    "sales",
    "dev",
    "solo",
    "cloud",
    "blog",
    "lead",
    "onboard",
    "proposal",
    "quote",
    "l",
    "d",
    "p",
    "f",
    "why-segmiq",
    "security",
    "products",
    "features",
    "pricing",
    "contact",
    "partners",
    "careers",
    "privacy",
    "terms",
    "status",
    "legal",
    "category",
  ]);

  if (appRoots.has(root)) return null;
  return `/blog/${root}`;
}

export const config = {
  // Pages: skip Next internals and static assets.
  // APIs: included for MFA enrolment gate only (see enforceApiMfaEnrolmentGate).
  matcher: [
    "/((?!_next/|favicon\\.ico|favicon/|manifest\\.json|manifest\\.webmanifest|sw\\.js|icons/|downloads/|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|apk)$).*)",
    "/api/:path*",
  ],
};
