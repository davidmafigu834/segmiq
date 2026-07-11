import sharp from "sharp";

const PRINT_COVER_MAX_WIDTH = 900;
const PRINT_GALLERY_MAX_WIDTH = 720;
const PRINT_LOGO_MAX_WIDTH = 160;
const PRINT_JPEG_QUALITY = 82;

export async function optimizeImageToDataUrl(
  url: string,
  maxWidth: number
): Promise<string | null> {
  if (!url || url.startsWith("data:")) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const input = Buffer.from(await res.arrayBuffer());
    const optimized = await sharp(input)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: PRINT_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${optimized.toString("base64")}`;
  } catch {
    return null;
  }
}

export function printImageMaxWidth(className: string): number {
  if (className.includes("print-cover-img")) return PRINT_COVER_MAX_WIDTH;
  if (className.includes("print-logo-chip")) return PRINT_LOGO_MAX_WIDTH;
  if (className.includes("print-timeline-img")) return 480;
  if (className.includes("print-capability")) return 480;
  return PRINT_GALLERY_MAX_WIDTH;
}
