/**
 * Generate favicon + PWA icons from public/brand/segmiq-q-source.png
 * Usage: node scripts/generate-brand-icons.mjs
 */
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public/brand/segmiq-q-source.png");

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writePng(rel, size, { padded = false, padRatio = 0.12 } = {}) {
  const out = join(root, rel);
  await ensureDir(out);

  let pipeline = sharp(source).resize(size, size, {
    fit: "cover",
    position: "centre",
  });

  if (padded) {
    const inner = Math.round(size * (1 - padRatio * 2));
    const buf = await sharp(source)
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .png()
      .toBuffer();
    pipeline = sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).composite([{ input: buf, gravity: "centre" }]);
  }

  await pipeline.png().toFile(out);
  console.log("wrote", rel);
}

/** Build a multi-size .ico that embeds PNG payloads (supported by modern browsers). */
function pngsToIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];

  for (const png of pngBuffers) {
    // IHDR is at bytes 16-23 of a PNG: width/height big-endian
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    entries.push({
      width: width >= 256 ? 0 : width,
      height: height >= 256 ? 0 : height,
      size: png.length,
      offset,
      png,
    });
    offset += png.length;
  }

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0); // reserved
  out.writeUInt16LE(1, 2); // type = icon
  out.writeUInt16LE(count, 4);

  let entryOffset = 6;
  for (const e of entries) {
    out.writeUInt8(e.width, entryOffset);
    out.writeUInt8(e.height, entryOffset + 1);
    out.writeUInt8(0, entryOffset + 2); // colors
    out.writeUInt8(0, entryOffset + 3); // reserved
    out.writeUInt16LE(1, entryOffset + 4); // planes
    out.writeUInt16LE(32, entryOffset + 6); // bit count
    out.writeUInt32LE(e.size, entryOffset + 8);
    out.writeUInt32LE(e.offset, entryOffset + 12);
    entryOffset += 16;
  }

  for (const e of entries) {
    e.png.copy(out, e.offset);
  }
  return out;
}

async function main() {
  await writePng("public/brand/segmiq-q.png", 512);

  await writePng("public/icon.png", 512);
  await writePng("public/apple-touch-icon.png", 180);
  await writePng("app/icon.png", 512);

  await writePng("public/favicon/favicon-16x16.png", 16);
  await writePng("public/favicon/favicon-32x32.png", 32);
  await writePng("public/favicon/apple-touch-icon.png", 180);
  await writePng("public/favicon/android-chrome-192x192.png", 192);
  await writePng("public/favicon/android-chrome-512x512.png", 512);

  await writePng("public/icons/icon-192.png", 192);
  await writePng("public/icons/icon-512.png", 512);
  await writePng("public/icons/apple-touch-icon.png", 180);
  await writePng("public/icons/icon-512-maskable.png", 512, {
    padded: true,
    padRatio: 0.18,
  });

  await writePng("field-app/assets/icon-only.png", 1024);
  await writePng("field-app/assets/icon-foreground.png", 1024, {
    padded: true,
    padRatio: 0.12,
  });
  await writePng("sales-app/assets/icon-only.png", 1024);
  await writePng("sales-app/assets/icon-foreground.png", 1024, {
    padded: true,
    padRatio: 0.12,
  });

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toFile(join(root, "field-app/assets/icon-background.png"));
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toFile(join(root, "sales-app/assets/icon-background.png"));
  console.log("wrote field/sales icon-background.png");

  const icoPngs = await Promise.all(
    [16, 32, 48].map((s) =>
      sharp(source)
        .resize(s, s, { fit: "cover", position: "centre" })
        .png()
        .toBuffer()
    )
  );
  const ico = pngsToIco(icoPngs);
  await writeFile(join(root, "public/favicon/favicon.ico"), ico);
  await writeFile(join(root, "public/favicon.ico"), ico);
  await writeFile(join(root, "app/favicon.ico"), ico);
  console.log("wrote favicon.ico");
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
