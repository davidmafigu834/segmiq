import sharp from "sharp";

const PRINT_COVER_MAX_WIDTH = 900;
const PRINT_GALLERY_MAX_WIDTH = 720;
const PRINT_LOGO_MAX_WIDTH = 160;
const PRINT_JPEG_QUALITY = 82;

function dataUrl(bytes: Buffer, contentType: string): string {
  const type = contentType.startsWith("image/") ? contentType : "image/jpeg";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Inline a print image so headless Chrome embeds it in the PDF. */
export async function optimizeImageToDataUrl(
  url: string,
  maxWidth: number
): Promise<string | null> {
  if (!url || url.startsWith("data:")) return null;

  let input: Buffer;
  let contentType = "image/jpeg";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || contentType;
    input = Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }

  try {
    const optimized = await sharp(input)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: PRINT_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return dataUrl(optimized, "image/jpeg");
  } catch {
    return dataUrl(input, contentType);
  }
}

export function printImageMaxWidth(className: string): number {
  if (className.includes("print-cover-img")) return PRINT_COVER_MAX_WIDTH;
  if (className.includes("print-logo-chip")) return PRINT_LOGO_MAX_WIDTH;
  if (className.includes("print-timeline-img")) return 480;
  if (className.includes("print-capability")) return 480;
  return PRINT_GALLERY_MAX_WIDTH;
}
