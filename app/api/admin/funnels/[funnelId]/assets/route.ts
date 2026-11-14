import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicUrl, putObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

/** Public asset for a funnel (photos, logo, brochure). Returns a URL to paste into the page HTML. */
export async function POST(req: Request, { params }: { params: { funnelId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden" }, { status: origin.status });
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.funnelId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: funnel } = await createAdminClient().from("re_listing_funnels").select("client_id").eq("id", params.funnelId).maybeSingle();
  if (!funnel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large. Max 8 MB." }, { status: 400 });
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = TYPES[ext];
  if (!contentType) return NextResponse.json({ error: "Use JPG, PNG, WEBP, AVIF, SVG, MP4 or PDF" }, { status: 400 });
  const key = `clients/${(funnel as { client_id: string }).client_id}/funnels/${params.funnelId}/${randomUUID()}.${ext}`;
  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), contentType, { cacheControl: "public, max-age=31536000, immutable" });
  } catch (error) {
    console.error("[funnel asset upload]", error);
    return NextResponse.json({ error: "Upload failed. Check storage configuration." }, { status: 500 });
  }
  return NextResponse.json({ url: getPublicUrl(key), name: file.name }, { status: 201 });
}
