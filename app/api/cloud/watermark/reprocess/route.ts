import { NextResponse } from "next/server";
import sharp from "sharp";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObject, putObject } from "@/lib/storage/r2";
import { applyWatermark } from "@/lib/watermark";

export const maxDuration = 60;

type MediaRow = { id: string; storage_key: string };

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = session.clientId;
  const supabase = createAdminClient();

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

  const logoKey = (clientResult.data as { logo_key?: string | null } | null)?.logo_key ?? null;
  const watermarkEnabled = !!(profile?.watermark_enabled && logoKey);

  const { data: mediaItems } = await supabase
    .from("project_media")
    .select("id, storage_key")
    .eq("client_id", clientId)
    .neq("type", "video")
    .not("storage_key", "is", null);

  if (!mediaItems?.length) {
    return NextResponse.json({ processed: 0, failed: 0, total: 0 });
  }

  const processable = (mediaItems as MediaRow[]).filter(
    (m) => m.storage_key && /\/projects\/[^/]+\/photos\//.test(m.storage_key)
  );

  if (!processable.length) {
    return NextResponse.json({ processed: 0, failed: 0, total: 0 });
  }

  let logoBuffer: Buffer | null = null;
  if (watermarkEnabled && logoKey) {
    try {
      logoBuffer = await getObject(logoKey);
    } catch {
      return NextResponse.json({ error: "Logo not found in storage" }, { status: 400 });
    }
  }

  let processed = 0;
  let failed = 0;

  const CONCURRENCY = 3;
  for (let i = 0; i < processable.length; i += CONCURRENCY) {
    const batch = processable.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        try {
          const originalKey = item.storage_key.replace(/\/photos\//, "/originals/");
          const publicKey = item.storage_key;

          const photoBuffer = await getObject(originalKey);

          let outputBuffer: Buffer;
          if (watermarkEnabled && logoBuffer) {
            outputBuffer = await applyWatermark(photoBuffer, logoBuffer, {
              position: (profile?.watermark_position ?? "bottom-right") as
                "bottom-right" | "bottom-left" | "bottom-center" | "center",
              opacity: profile?.watermark_opacity ?? 40,
              size: (profile?.watermark_size ?? "small") as "small" | "medium" | "large",
            });
          } else {
            outputBuffer = await sharp(photoBuffer).jpeg({ quality: 90 }).toBuffer();
          }

          await putObject(publicKey, outputBuffer, "image/jpeg");
          await supabase
            .from("project_media")
            .update({ watermarked: watermarkEnabled })
            .eq("id", item.id);

          processed++;
        } catch (err) {
          console.error(`[watermark/reprocess] failed for media ${item.id}:`, err);
          failed++;
        }
      })
    );
  }

  return NextResponse.json({ processed, failed, total: processable.length });
}
