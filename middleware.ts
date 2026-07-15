import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createAdminClient } from "@/lib/supabase/admin";
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
      const uid = (token as { userId?: string }).userId;
      if (uid) {
        try {
          const supabase = createAdminClient();
          const { data: row } = await supabase.from("users").select("session_version").eq("id", uid).maybeSingle();
          const dbSv = Number((row as { session_version?: number } | null)?.session_version ?? 0);
          if (dbSv !== tokenSv) {
            const signOut = new URL("/api/auth/signout", req.url);
            signOut.searchParams.set("callbackUrl", "/login?reason=session");
            return NextResponse.redirect(signOut);
          }
        } catch {
          /* fail open */
        }
      }
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
      const role = token.role as UserRole;
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
    if (secret === process.env.CRON_SECRET || process.env.NODE_ENV === "development") {
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
    path === "/cloud/help" ||
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
  const uid = (token as { userId?: string }).userId;
  if (uid) {
    try {
      const supabase = createAdminClient();
      const { data: row } = await supabase.from("users").select("session_version").eq("id", uid).maybeSingle();
      const dbSv = Number((row as { session_version?: number } | null)?.session_version ?? 0);
      if (dbSv !== tokenSv) {
        const signOut = new URL("/api/auth/signout", req.url);
        signOut.searchParams.set("callbackUrl", "/login?reason=session");
        return NextResponse.redirect(signOut);
      }
    } catch {
      /* fail open */
    }
  }

  const role = token.role as UserRole;
  const clientMode = (token as { clientMode?: ClientMode }).clientMode ?? "team";

  if (path.startsWith("/dashboard")) {
    if (role !== "AGENCY_ADMIN") {
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
  }
  if (path.startsWith("/client")) {
    const isTeamPreview =
      role === "AGENCY_ADMIN" &&
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
    if (role !== "SALESPERSON") {
      return NextResponse.redirect(new URL(homeForRole(role, clientMode), req.url));
    }
    if (clientMode === "solo" && (path === "/sales/dashboard" || path.startsWith("/sales/dashboard/"))) {
      return NextResponse.redirect(new URL("/solo/dashboard", req.url));
    }
  }

  // Billing access gate. A suspended subscription locks manager and salespeople
  // out of their portals. Exempt blocked screens and billing pages so clients can
  // pay and upload proof. API routes are not matched by middleware.
  const isGatedRole = role === "CLIENT_MANAGER" || role === "SALESPERSON";
  if (isGatedRole) {
    const gateExempt =
      path === "/client/blocked" ||
      path === "/sales/blocked" ||
      path === "/solo/blocked" ||
      path === "/client/billing" ||
      path.startsWith("/client/billing/") ||
      path === "/solo/billing" ||
      path.startsWith("/solo/billing/");
    const cid = (token as { clientId?: string | null }).clientId;
    if (!gateExempt && cid) {
      try {
        const supabase = createAdminClient();
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("client_id", cid)
          .eq("product", "crm")
          .limit(1)
          .maybeSingle();
        if ((sub as { status?: string } | null)?.status === "suspended") {
          if (role === "CLIENT_MANAGER") {
            return NextResponse.redirect(new URL("/client/blocked", req.url));
          }
          if (role === "SALESPERSON" && clientMode === "solo") {
            return NextResponse.redirect(new URL("/solo/blocked", req.url));
          }
          return NextResponse.redirect(new URL("/sales/blocked", req.url));
        }
      } catch {
        /* fail open — never lock users out due to a transient DB error */
      }
    }
  }

  return NextResponse.next();
}

function homeForRole(role: UserRole, clientMode: ClientMode = "team"): string {
  if (role === "AGENCY_ADMIN") return "/dashboard";
  if (role === "CLIENT_MANAGER") return "/client/dashboard";
  if (role === "SALESPERSON" && clientMode === "solo") return "/solo/dashboard";
  return "/sales/dashboard";
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
    resolved === "/cloud/help" ||
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
  // Skip all Next.js internals (dev + prod), API routes, and static assets — otherwise
  // middleware can run on e.g. /_next/webpack-hmr and return HTML redirects, breaking JS chunks (MIME errors).
  matcher: [
    "/((?!_next/|api/|favicon\\.ico|favicon/|manifest\\.json|manifest\\.webmanifest|sw\\.js|icons/|downloads/|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|apk)$).*)",
  ],
};
