import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { putObject } from "@/lib/storage/r2";
import { resolveWhatsAppSendConfig } from "./credentials";

type MediaRef = {
  id?: string;
  mime_type?: string;
  caption?: string;
};

export async function fetchWhatsAppMediaAsset(
  clientId: string,
  media: MediaRef | undefined
): Promise<{ url: string | null; mimeType: string | null; caption: string | null }> {
  if (!media?.id) {
    return { url: null, mimeType: media?.mime_type ?? null, caption: media?.caption?.trim() ?? null };
  }

  const config = await resolveWhatsAppSendConfig(clientId);
  if (!config?.accessToken) {
    return { url: null, mimeType: media.mime_type ?? null, caption: media.caption?.trim() ?? null };
  }

  try {
    const metaRes = await fetch(`${getFacebookGraphBase()}/${media.id}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!metaRes.ok || !meta.url) {
      return { url: null, mimeType: media.mime_type ?? null, caption: media.caption?.trim() ?? null };
    }

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!fileRes.ok) {
      return { url: null, mimeType: meta.mime_type ?? media.mime_type ?? null, caption: media.caption?.trim() ?? null };
    }

    const mimeType = meta.mime_type ?? media.mime_type ?? "application/octet-stream";
    const ext = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
    const key = `whatsapp/${clientId}/${media.id}.${ext}`;
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    await putObject(key, buffer, mimeType);

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
      : null;

    return {
      url: publicUrl,
      mimeType,
      caption: media.caption?.trim() ?? null,
    };
  } catch {
    return { url: null, mimeType: media.mime_type ?? null, caption: media.caption?.trim() ?? null };
  }
}
