import { NextResponse } from "next/server";
import sharp from "sharp";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObject, putObject } from "@/lib/storage/r2";
import { applyWatermark } from "@/lib/watermark";

export const maxDuration = 60;

type MediaRow = { id: string; storage_key: string; watermarked: boolean | null };

async function fetchBuffer(key: string): Promise<Buffer> {
  return getObject(key);
}

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
    .select("id, storage_key, watermarked")
    .eq("client_id", clientId)
    .neq("type", "video")
    .not("storage_key", "is", null);

  if (!mediaItems?.length) {
    return NextResponse.json({ processed: 0, failed: 0, total: 0 });
  }

  const processable = (mediaItems as MediaRow[]).filter(
    (m) =>
      m.storage_key &&
      (/\/projects\/[^/]+\/photos\//.test(m.storage_key) ||
        /\/projects\/[^/]+\/originals\//.test(m.storage_key))
  );

  if (!processable.length) {
    return NextResponse.json({ processed: 0, failed: 0, total: 0 });
  }

  let logoBuffer: Buffer | null = null;
  if (watermarkEnabled && logoKey) {
    try {
      logoBuffer = await getObject(logoKey);
    } catch {
      return NextResponse.json({ error: "Logo not found in storage — upload a logo first." }, { status: 400 });
    }
  }

  let processed = 0;
  let failed = 0;
  let firstError: string | null = null;

  const CONCURRENCY = 3;
  for (let i = 0; i < processable.length; i += CONCURRENCY) {
    const batch = processable.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        try {
          const hasPhotosKey = /\/photos\//.test(item.storage_key);
          const originalKey = hasPhotosKey
            ? item.storage_key.replace(/\/photos\//, "/originals/")
            : item.storage_key;
          const publicKey = hasPhotosKey
            ? item.storage_key
            : item.storage_key.replace(/\/originals\//, "/photos/");

          let rawBuffer: Buffer;
          try {
            rawBuffer = await fetchBuffer(originalKey);
          } catch {
            rawBuffer = await fetchBuffer(item.storage_key);
          }

          const jpegBuffer = await sharp(rawBuffer).jpeg({ quality: 92 }).toBuffer();

          let outputBuffer: Buffer;
          if (watermarkEnabled && logoBuffer) {
            outputBuffer = await applyWatermark(jpegBuffer, logoBuffer, {
              position: (profile?.watermark_position ?? "bottom-right") as
                "bottom-right" | "bottom-left" | "bottom-center" | "center",
              opacity: profile?.watermark_opacity ?? 40,
              size: (profile?.watermark_size ?? "small") as "small" | "medium" | "large",
            });
          } else {
            outputBuffer = jpegBuffer;
          }

          await putObject(publicKey, outputBuffer, "image/jpeg");
          await supabase
            .from("project_media")
            .update({
              storage_key: publicKey,
              watermarked: watermarkEnabled,
            })
            .eq("id", item.id);

          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!firstError) firstError = msg;
          console.error(`[watermark/reprocess] failed for media ${item.id}:`, msg);
          failed++;
        }
      })
    );
  }

  return NextResponse.json({ processed, failed, total: processable.length, firstError });
}
