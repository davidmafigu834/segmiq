import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObject, putObject } from "@/lib/storage/r2";
import { applyWatermark } from "@/lib/watermark";
import {
  publicUrlForStorageKey,
  resolveClientLogoKey,
  resolveMediaKeys,
} from "@/lib/watermark/storage-keys";

export const maxDuration = 30;


export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { mediaId?: string; originalKey?: string; clientId?: string };
  const { mediaId, originalKey, clientId } = body;

  if (!mediaId || !originalKey || !clientId) {
    return NextResponse.json({ error: "mediaId, originalKey, and clientId are required" }, { status: 400 });
  }

  const { originalKey: sourceKey, publicKey } = resolveMediaKeys(originalKey);
  const publicUrl = publicUrlForStorageKey(originalKey);

  const supabase = createAdminClient();

  async function storeAsIs(): Promise<void> {
    const photoBuffer = await getObject(sourceKey);
    await putObject(publicKey, photoBuffer, "image/jpeg");
    await supabase
      .from("project_media")
      .update({ public_url: publicUrl, storage_key: publicKey })
      .eq("id", mediaId!);
  }

  const [profileResult, clientResult] = await Promise.all([
    supabase
      .from("client_profiles")
      .select("watermark_enabled, watermark_position, watermark_opacity, watermark_size")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("logo_key, logo_url")
      .eq("id", clientId)
      .maybeSingle(),
  ]);

  const profile = profileResult.data as {
    watermark_enabled?: boolean;
    watermark_position?: string;
    watermark_opacity?: number;
    watermark_size?: string;
  } | null;

  const logoKey = resolveClientLogoKey(
    clientResult.data as { logo_key?: string | null; logo_url?: string | null } | null
  );

  if (
    logoKey &&
    !(clientResult.data as { logo_key?: string | null } | null)?.logo_key
  ) {
    await supabase
      .from("clients")
      .update({ logo_key: logoKey, updated_at: new Date().toISOString() })
      .eq("id", clientId);
  }

  if (!profile?.watermark_enabled || !logoKey) {
    await storeAsIs();
    return NextResponse.json({ success: true, watermarked: false, publicUrl });
  }

  try {
    const [photoBuffer, logoBuffer] = await Promise.all([
      getObject(sourceKey),
      getObject(logoKey),
    ]);

    const watermarkedBuffer = await applyWatermark(photoBuffer, logoBuffer, {
      position: (profile.watermark_position ?? "bottom-right") as
        "bottom-right" | "bottom-left" | "bottom-center" | "center",
      opacity: profile.watermark_opacity ?? 40,
      size: (profile.watermark_size ?? "small") as "small" | "medium" | "large",
    });

    await putObject(publicKey, watermarkedBuffer, "image/jpeg");

    await supabase
      .from("project_media")
      .update({ public_url: publicUrl, storage_key: publicKey, watermarked: true })
      .eq("id", mediaId);

    return NextResponse.json({ success: true, watermarked: true, publicUrl });
  } catch (err) {
    console.error("[watermark/apply]", err);
    try { await storeAsIs(); } catch { /* non-fatal */ }
    return NextResponse.json({
      success: true,
      watermarked: false,
      publicUrl,
      error: "Watermark failed — stored original",
    });
  }
}
