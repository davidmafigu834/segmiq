import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { generatePresignedUploadUrl, generateOriginalMediaKey, generateHeroKey, generateTestimonialPhotoKey, generateVideoKey, getPublicUrl } from "@/lib/storage/r2";
import { generateLogoKey, resolveImageContentType } from "@/lib/storage/logo-upload";
import {
  MEDIA_PHOTO_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
  isAllowedMediaContentType,
  resolveMediaContentType,
} from "@/lib/storage/media-content-type";

export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType: rawContentType, clientId, projectId, purpose, fileSize } = await req.json() as {
    filename: string;
    contentType: string;
    clientId: string;
    projectId?: string;
    purpose?: "hero" | "media" | "testimonial" | "logo";
    fileSize?: number;
  };

  const contentType =
    purpose === "logo"
      ? resolveImageContentType(filename, rawContentType) ?? rawContentType
      : resolveMediaContentType(filename, rawContentType) ?? rawContentType;

  if (purpose === "logo" && !contentType) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WEBP, and HEIC images are supported" },
      { status: 400 }
    );
  }

  if (purpose !== "logo" && !contentType) {
    return NextResponse.json(
      {
        error:
          "File type not supported. Upload photos (JPEG, PNG, WEBP, HEIC) or videos (MP4, MOV, WEBM, 3GP).",
      },
      { status: 400 }
    );
  }

  const isVideo = contentType.startsWith("video/");
  const maxSize = isVideo ? MEDIA_VIDEO_MAX_BYTES : MEDIA_PHOTO_MAX_BYTES;
  if (fileSize && fileSize > maxSize) {
    return NextResponse.json(
      {
        error: isVideo
          ? "Video is too large. Maximum size is 200MB. For longer videos, use a YouTube link instead."
          : "Photo is too large. Maximum size is 20MB.",
      },
      { status: 400 }
    );
  }

  if (auth.role !== "AGENCY_ADMIN" && auth.clientId !== clientId) {
    return NextResponse.json(
      { error: "You do not have permission to upload to this client." },
      { status: 403 }
    );
  }

  if (!isAllowedMediaContentType(contentType)) {
    return NextResponse.json(
      { error: "File type not supported. Upload photos (JPEG, PNG, WEBP, HEIC) or videos (MP4, MOV, WEBM, 3GP)." },
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
    key = isVideo
      ? generateVideoKey(clientId, projectId, filename)
      : generateOriginalMediaKey(clientId, projectId, filename);
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
