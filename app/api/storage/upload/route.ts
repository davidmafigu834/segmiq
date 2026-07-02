import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import {
  generateOriginalMediaKey,
  generateVideoKey,
  getPublicUrl,
  putObject,
} from "@/lib/storage/r2";
import {
  MEDIA_PHOTO_MAX_BYTES,
  MEDIA_SERVER_UPLOAD_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
  isAllowedMediaContentType,
  resolveMediaContentType,
} from "@/lib/storage/media-content-type";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const clientId = String(form.get("clientId") ?? "").trim();
  const projectId = String(form.get("projectId") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  if (auth.role !== "AGENCY_ADMIN" && auth.clientId !== clientId) {
    return NextResponse.json(
      { error: "You do not have permission to upload to this client." },
      { status: 403 }
    );
  }

  const contentType = resolveMediaContentType(file.name, file.type);
  if (!contentType || !isAllowedMediaContentType(contentType)) {
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
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        error: isVideo
          ? "Video is too large. Maximum size is 200MB."
          : "Photo is too large. Maximum size is 20MB.",
      },
      { status: 400 }
    );
  }

  if (file.size > MEDIA_SERVER_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        error: "File exceeds server upload limit. Use presigned upload.",
        code: "USE_PRESIGN",
      },
      { status: 413 }
    );
  }

  try {
    const key = isVideo
      ? generateVideoKey(clientId, projectId, file.name)
      : generateOriginalMediaKey(clientId, projectId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, contentType);
    return NextResponse.json({ key, publicUrl: getPublicUrl(key) });
  } catch (err) {
    console.error("[storage/upload]", err);
    return NextResponse.json(
      { error: "Failed to upload file. Check R2 configuration." },
      { status: 500 }
    );
  }
}
