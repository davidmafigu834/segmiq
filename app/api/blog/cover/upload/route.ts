import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { resolveImageContentType } from "@/lib/storage/logo-upload";
import { generateBlogCoverKey, getPublicUrl, putObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB." }, { status: 400 });
  }

  const contentType = resolveImageContentType(file.name, file.type);
  if (!contentType || !ALLOWED.has(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WEBP images are supported." }, { status: 400 });
  }

  try {
    const key = generateBlogCoverKey(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ publicUrl, key });
  } catch (err) {
    console.error("[blog cover upload]", err);
    return NextResponse.json({ error: "Failed to upload image. Check R2 configuration." }, { status: 500 });
  }
}
