import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

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

  const isCloudSubdomain = host === "cloud.leadstaq.tech" || host === "cloud.localhost";

  if (isCloudSubdomain) {
    const path = req.nextUrl.pathname;

    // Map known URL paths to internal /cloud/* paths.
    // IMPORTANT: only rewrite explicit cloud routes — do NOT catch static files
    // like /manifest.json, /sw.js, /icons/* (those must be served as-is).
    let cloudPath: string | null = null;
    if (path === "/") {
      cloudPath = "/cloud";
    } else if (
      path === "/login" ||
      path === "/signup" ||
      path === "/forgot-password" ||
      path === "/reset-password" ||
      path.startsWith("/dashboard") ||
      path.startsWith("/share/")
    ) {
      cloudPath = "/cloud" + path;
    }
    // /manifest.json, /sw.js, /icons/*, /api/*, etc. pass through unchanged

    // Resolved internal path for auth checks
    const resolved = cloudPath ?? path;

    // Public cloud paths — no auth required
    const isCloudPublic =
      resolved === "/cloud" ||
      resolved === "/cloud/login" ||
      resolved === "/cloud/signup" ||
      resolved === "/cloud/forgot-password" ||
      resolved === "/cloud/reset-password" ||
      resolved === "/cloud/help" ||
      resolved.startsWith("/cloud/share/");

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
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  if (!isCloudSubdomain && host && host !== appDomain && host.endsWith("." + appDomain)) {
    const slug = host.slice(0, -(appDomain.length + 1));
    if (slug && slug !== "www") {
      const url = req.nextUrl.clone();
      url.pathname = `/p/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/facebook/webhook")) return NextResponse.next();
  if (path.startsWith("/api/leads/submit")) return NextResponse.next();
  if (path.startsWith("/api/leads/magic/")) return NextResponse.next();
  if (path.startsWith("/api/cron/")) {
    const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (secret === process.env.CRON_SECRET || process.env.NODE_ENV === "development") {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPublic =
    path === "/login" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/lead/") ||
    path.startsWith("/p/") ||
    path === "/cloud" ||
    path === "/cloud/login" ||
    path === "/cloud/signup" ||
    path === "/cloud/forgot-password" ||
    path === "/cloud/reset-password" ||
    path === "/cloud/help" ||
    path.startsWith("/cloud/share/");

  if (isPublic) return NextResponse.next();

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

  if (path.startsWith("/dashboard")) {
    if (role !== "AGENCY_ADMIN") {
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }
  }
  if (path.startsWith("/client")) {
    const isTeamPreview =
      role === "AGENCY_ADMIN" &&
      (path === "/client/team" || path.startsWith("/client/team/")) &&
      req.nextUrl.searchParams.has("clientId");
    if (!isTeamPreview && role !== "CLIENT_MANAGER") {
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }
  }
  if (path.startsWith("/sales")) {
    if (role !== "SALESPERSON") {
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }
  }

  return NextResponse.next();
}

function homeForRole(role: UserRole): string {
  if (role === "AGENCY_ADMIN") return "/dashboard";
  if (role === "CLIENT_MANAGER") return "/client/dashboard";
  return "/sales/leads";
}

export const config = {
  // Skip all Next.js internals (dev + prod), API routes, and static assets — otherwise
  // middleware can run on e.g. /_next/webpack-hmr and return HTML redirects, breaking JS chunks (MIME errors).
  matcher: [
    "/((?!_next/|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
