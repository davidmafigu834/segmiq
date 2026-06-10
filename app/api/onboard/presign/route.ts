import { NextResponse } from "next/server";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/storage/r2";
import { findOnboardingToken } from "@/lib/onboarding/tokens";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

function generateLogoKey(clientId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "png";
  return `clients/${clientId}/logo/${Date.now()}.${ext}`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    filename?: string;
    contentType?: string;
    fileSize?: number;
  };

  const { token, filename, contentType, fileSize } = body;
  if (!token || !filename || !contentType) {
    return NextResponse.json({ error: "token, filename, and contentType are required" }, { status: 400 });
  }

  const tokenResult = await findOnboardingToken(token);
  if (!tokenResult.ok) {
    const status = tokenResult.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: tokenResult.reason }, { status });
  }

  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WEBP images are supported" }, { status: 400 });
  }
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  try {
    const key = generateLogoKey(tokenResult.client.id, filename);
    const uploadUrl = await generatePresignedUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    console.error("[onboard presign]", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
