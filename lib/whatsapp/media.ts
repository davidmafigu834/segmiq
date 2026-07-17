import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { getPublicUrl, putObject } from "@/lib/storage/r2";
import { resolveWhatsAppSendConfig } from "./credentials";

type MediaRef = {
  id?: string;
  mime_type?: string;
  caption?: string;
};

export type WhatsAppMediaAsset = {
  url: string | null;
  mimeType: string | null;
  caption: string | null;
  storageKey: string | null;
};

function mimeExtension(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/mp4" || base === "audio/aac") return "m4a";
  if (base === "audio/amr") return "amr";
  return base.split("/")[1]?.split("+")[0] ?? "bin";
}

export async function fetchWhatsAppMediaAsset(
  clientId: string,
  media: MediaRef | undefined
): Promise<WhatsAppMediaAsset> {
  if (!media?.id) {
    return {
      url: null,
      mimeType: media?.mime_type ?? null,
      caption: media?.caption?.trim() ?? null,
      storageKey: null,
    };
  }

  const config = await resolveWhatsAppSendConfig(clientId);
  if (!config?.accessToken) {
    return {
      url: null,
      mimeType: media.mime_type ?? null,
      caption: media.caption?.trim() ?? null,
      storageKey: null,
    };
  }

  try {
    const metaRes = await fetch(`${getFacebookGraphBase()}/${media.id}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!metaRes.ok || !meta.url) {
      return {
        url: null,
        mimeType: media.mime_type ?? null,
        caption: media.caption?.trim() ?? null,
        storageKey: null,
      };
    }

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!fileRes.ok) {
      return {
        url: null,
        mimeType: meta.mime_type ?? media.mime_type ?? null,
        caption: media.caption?.trim() ?? null,
        storageKey: null,
      };
    }

    const mimeType = meta.mime_type ?? media.mime_type ?? "application/octet-stream";
    const ext = mimeExtension(mimeType);
    const key = `whatsapp/${clientId}/${media.id}.${ext}`;
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    await putObject(key, buffer, mimeType);

    let url: string | null = null;
    try {
      url = getPublicUrl(key);
    } catch {
      url = null;
    }

    return {
      url,
      mimeType,
      caption: media.caption?.trim() ?? null,
      storageKey: key,
    };
  } catch {
    return {
      url: null,
      mimeType: media.mime_type ?? null,
      caption: media.caption?.trim() ?? null,
      storageKey: null,
    };
  }
}

/** Resolve playable URL for inbox — public R2 URL or authenticated proxy. */
export function resolveWhatsAppMediaUrl(
  messageId: string,
  mediaUrl: string | null | undefined,
  storageKey: string | null | undefined
): string | null {
  if (mediaUrl?.trim()) return mediaUrl.trim();
  if (storageKey?.trim()) return `/api/inbox/whatsapp-media/${messageId}`;
  return null;
}
