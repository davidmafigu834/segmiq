/**
 * Generates sales-app/assets/icon-foreground.png and icon-background.png
 * for @capacitor/assets adaptive Android icons.
 * Design: black background, lime rounded square with phone icon, "Segmiq Sales" below.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const size = 1024;
const accent = "#D4FF4F";
const accentInk = "#000000";
const bg = "#0a0a0a";

// Lucide-style phone (24x24 viewBox), scaled and centered in lime tile
const phonePath =
  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";

const tileSize = 420;
const tileRadius = 96;
const tileX = (size - tileSize) / 2;
const tileY = 200;
const phoneScale = 9.5;
const phoneTx = size / 2 - 12 * phoneScale;
const phoneTy = tileY + tileSize / 2 - 12 * phoneScale;

const foregroundSvg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" rx="${tileRadius}" fill="${accent}"/>
  <g transform="translate(${phoneTx} ${phoneTy}) scale(${phoneScale})">
    <path d="${phonePath}" fill="none" stroke="${accentInk}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="50%" y="${tileY + tileSize + 88}" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
    font-size="72" font-weight="600" fill="${accent}" letter-spacing="-1">Segmiq Sales</text>
</svg>`;

await sharp(Buffer.from(foregroundSvg)).png().toFile(join(assetsDir, "icon-foreground.png"));

await sharp({
  create: { width: size, height: size, channels: 3, background: bg },
})
  .png()
  .toFile(join(assetsDir, "icon-background.png"));

await sharp(Buffer.from(foregroundSvg))
  .flatten({ background: bg })
  .png()
  .toFile(join(assetsDir, "icon-only.png"));

console.log(
  "Wrote sales-app/assets/icon-foreground.png, icon-background.png, and icon-only.png"
);
