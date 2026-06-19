/**
 * Generates field-app/assets/icon-foreground.png and icon-background.png
 * for @capacitor/assets adaptive Android icons.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const size = 1024;
const fontSize = Math.round(size * 0.65);

const foregroundSvg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', 'Palatino Linotype', serif"
    font-size="${fontSize}" font-weight="700" fill="#D4FF4F">Q</text>
</svg>`;

await sharp(Buffer.from(foregroundSvg)).png().toFile(join(assetsDir, "icon-foreground.png"));

await sharp({
  create: { width: size, height: size, channels: 3, background: "#0a0a0a" },
})
  .png()
  .toFile(join(assetsDir, "icon-background.png"));

// icon-only satisfies @capacitor/assets entry check; adaptive layers use foreground/background.
await sharp(Buffer.from(foregroundSvg))
  .flatten({ background: "#0a0a0a" })
  .png()
  .toFile(join(assetsDir, "icon-only.png"));

console.log(
  "Wrote field-app/assets/icon-foreground.png, icon-background.png, and icon-only.png"
);
