import sharp from "sharp";

export function getLogoSize(photoWidth: number, size: "small" | "medium" | "large"): number {
  const ratios = { small: 0.12, medium: 0.22, large: 0.35 };
  return Math.round(photoWidth * ratios[size]);
}

export function getLogoPosition(
  photoWidth: number,
  photoHeight: number,
  logoWidth: number,
  logoHeight: number,
  position: "bottom-right" | "bottom-left" | "bottom-center" | "center",
  margin = 24
): { left: number; top: number } {
  switch (position) {
    case "bottom-right":
      return { left: photoWidth - logoWidth - margin, top: photoHeight - logoHeight - margin };
    case "bottom-left":
      return { left: margin, top: photoHeight - logoHeight - margin };
    case "bottom-center":
      return {
        left: Math.round((photoWidth - logoWidth) / 2),
        top: photoHeight - logoHeight - margin,
      };
    case "center":
      return {
        left: Math.round((photoWidth - logoWidth) / 2),
        top: Math.round((photoHeight - logoHeight) / 2),
      };
  }
}

export async function applyWatermark(
  photoBuffer: Buffer,
  logoBuffer: Buffer,
  settings: {
    position: "bottom-right" | "bottom-left" | "bottom-center" | "center";
    opacity: number;
    size: "small" | "medium" | "large";
  }
): Promise<Buffer> {
  const photoMeta = await sharp(photoBuffer).metadata();
  const photoWidth = photoMeta.width ?? 1920;
  const photoHeight = photoMeta.height ?? 1080;

  const logoWidth = getLogoSize(photoWidth, settings.size);

  const processedLogo = await sharp(logoBuffer)
    .resize(logoWidth, undefined, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .composite([{
      input: Buffer.alloc(4, Math.round((settings.opacity / 100) * 255)),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: "dest-in",
    }])
    .png()
    .toBuffer({ resolveWithObject: true });

  const { width: logoW, height: logoH } = processedLogo.info;
  const { left, top } = getLogoPosition(
    photoWidth,
    photoHeight,
    logoW,
    logoH,
    settings.position
  );

  return sharp(photoBuffer)
    .composite([{
      input: processedLogo.data,
      left,
      top,
      blend: "over",
    }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
