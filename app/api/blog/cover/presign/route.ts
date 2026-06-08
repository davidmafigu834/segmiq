import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { generateBlogCoverKey, generatePresignedUploadUrl, getPublicUrl } from "@/lib/storage/r2";

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { filename, contentType, fileSize } = (await req.json()) as {
    filename: string;
    contentType: string;
    fileSize?: number;
  };

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType are required." }, { status: 400 });
  }
  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WEBP images are supported." }, { status: 400 });
  }
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 10MB." }, { status: 400 });
  }

  try {
    const key = generateBlogCoverKey(filename);
    const uploadUrl = await generatePresignedUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    console.error("[blog cover presign]", err);
    return NextResponse.json({ error: "Failed to generate upload URL. Check R2 configuration." }, { status: 500 });
  }
}
