import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageCloudSettings } from "@/lib/auth/permissions";
import { generateCapabilityAssetKey, getPublicUrl, putObject } from "@/lib/storage/r2";
import { resolveImageContentType } from "@/lib/storage/logo-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.clientId) {
    return NextResponse.json({ error: "No client associated" }, { status: 400 });
  }
  if (!canManageCloudSettings(session, session.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Max 5 MB." }, { status: 400 });
  }

  const contentType = resolveImageContentType(file.name, file.type);
  if (!contentType) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WEBP, and HEIC images are supported" },
      { status: 400 }
    );
  }

  try {
    const key = generateCapabilityAssetKey(session.clientId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ publicUrl, key });
  } catch (err) {
    console.error("[capability upload]", err);
    return NextResponse.json({ error: "Failed to upload image. Check R2 configuration." }, { status: 500 });
  }
}
