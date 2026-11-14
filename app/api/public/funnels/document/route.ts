import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderFunnel } from "@/lib/real-estate/funnels/service";
import { FUNNEL_FRAME_SANDBOX } from "@/lib/real-estate/funnels/policy";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN = /^[A-Za-z0-9_-]{32,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function documentHeaders(): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    // Opaque origin even when opened directly: the bespoke page can never read SegmiQ cookies or call its APIs.
    "Content-Security-Policy": `sandbox ${FUNNEL_FRAME_SANDBOX}; frame-ancestors 'self'`,
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Robots-Tag": "noindex",
    "Cache-Control": "private, no-store",
  };
}

function unavailable(status = 404) {
  return new Response("<!doctype html><title>Unavailable</title><p>This page is unavailable.</p>", { status, headers: documentHeaders() });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const ref = url.searchParams.get("ref");
  const previewId = url.searchParams.get("preview");
  const previewHandle = url.searchParams.get("as");
  if (!SLUG.test(slug)) return unavailable(400);
  if (ref && !TOKEN.test(ref)) return unavailable(400);
  let preview: { funnelId: string } | null = null;
  if (previewId) {
    if (!UUID.test(previewId)) return unavailable(400);
    const session = await getServerSession(authOptions);
    if (session?.role !== "SUPER_ADMIN") return unavailable(403);
    preview = { funnelId: previewId };
  }
  const result = await renderFunnel(createAdminClient(), {
    slug,
    token: ref,
    preview,
    previewHandle: previewHandle && SLUG.test(previewHandle) ? previewHandle : null,
  });
  if (!result.ok) return unavailable(result.status);
  return new Response(result.html, { status: 200, headers: documentHeaders() });
}
