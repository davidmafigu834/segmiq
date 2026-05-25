import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObject, putObject, getPublicUrl } from "@/lib/storage/r2";
import { applyWatermark } from "@/lib/watermark";

export const maxDuration = 30;


export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { mediaId?: string; originalKey?: string; clientId?: string };
  const { mediaId, originalKey, clientId } = body;

  if (!mediaId || !originalKey || !clientId) {
    return NextResponse.json({ error: "mediaId, originalKey, and clientId are required" }, { status: 400 });
  }

  const publicKey = originalKey.replace("/originals/", "/photos/");
  const publicUrl = getPublicUrl(publicKey);

  const supabase = createAdminClient();

  async function storeAsIs(): Promise<void> {
    const photoBuffer = await getObject(originalKey!);
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
      .select("logo_key")
      .eq("id", clientId)
      .maybeSingle(),
  ]);

  const profile = profileResult.data as {
    watermark_enabled?: boolean;
    watermark_position?: string;
    watermark_opacity?: number;
    watermark_size?: string;
  } | null;

  const logoKey = (clientResult.data as { logo_key?: string | null } | null)?.logo_key;

  if (!profile?.watermark_enabled || !logoKey) {
    await storeAsIs();
    return NextResponse.json({ success: true, watermarked: false, publicUrl });
  }

  try {
    const [photoBuffer, logoBuffer] = await Promise.all([
      getObject(originalKey),
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
