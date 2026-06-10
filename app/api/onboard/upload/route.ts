import { NextResponse } from "next/server";
import { findOnboardingToken } from "@/lib/onboarding/tokens";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { generateLogoKey, resolveImageContentType } from "@/lib/storage/logo-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const token = String(form.get("token") ?? "").trim();
  const file = form.get("file");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  const tokenResult = await findOnboardingToken(token);
  if (!tokenResult.ok) {
    const status = tokenResult.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: tokenResult.reason }, { status });
  }

  const contentType = resolveImageContentType(file.name, file.type);
  if (!contentType) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WEBP, and HEIC images are supported" },
      { status: 400 }
    );
  }

  try {
    const key = generateLogoKey(tokenResult.client.id, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ publicUrl, key });
  } catch (err) {
    console.error("[onboard upload]", err);
    return NextResponse.json({ error: "Failed to upload image. Check R2 configuration." }, { status: 500 });
  }
}
