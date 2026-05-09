import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generatePresignedUploadUrl, generateOriginalMediaKey, generateHeroKey, generateTestimonialPhotoKey, getPublicUrl } from "@/lib/storage/r2";

function generateLogoKey(clientId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "png";
  return `clients/${clientId}/logo/${Date.now()}.${ext}`;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType, clientId, projectId, purpose } = await req.json() as {
    filename: string;
    contentType: string;
    clientId: string;
    projectId?: string;
    purpose?: "hero" | "media" | "testimonial" | "logo";
  };

  if (session.role !== "AGENCY_ADMIN" && session.clientId !== clientId) {
    return NextResponse.json(
      { error: "You do not have permission to upload to this client." },
      { status: 403 }
    );
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "File type not supported. Upload photos only (JPEG, PNG, WEBP, HEIC)." },
      { status: 400 }
    );
  }

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  let key: string;
  if (purpose === "hero") {
    key = generateHeroKey(clientId, filename);
  } else if (purpose === "testimonial") {
    key = generateTestimonialPhotoKey(clientId, filename);
  } else if (purpose === "logo") {
    key = generateLogoKey(clientId, filename);
  } else {
    if (!projectId) return NextResponse.json({ error: "projectId is required for media uploads" }, { status: 400 });
    key = generateOriginalMediaKey(clientId, projectId, filename);
  }

  try {
    const uploadUrl = await generatePresignedUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    console.error("[presign]", err);
    return NextResponse.json({ error: "Failed to generate upload URL. Check R2 configuration." }, { status: 500 });
  }
}
