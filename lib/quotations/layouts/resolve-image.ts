import { existsSync, readFileSync } from "fs";
import path from "path";

const MAX_BYTES = 4_000_000;

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "image/png";
}

function toDataUri(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function isSvgSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  return src.includes("image/svg") || /\.svg(\?|$)/i.test(src);
}

export function publicFileToDataUri(publicPath: string): string | null {
  const relative = publicPath.replace(/^\/+/, "").split("?")[0];
  const fsPath = path.join(process.cwd(), "public", relative);
  if (!existsSync(fsPath)) return null;
  const buf = readFileSync(fsPath);
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return toDataUri(buf, mimeFromExt(fsPath));
}

export async function fetchRasterDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) {
    if (url.startsWith("data:image/svg")) return null;
    return url;
  }
  if (url.startsWith("/")) {
    if (isSvgSrc(url)) {
      const pngSibling = url.replace(/\.svg(\?.*)?$/i, ".png");
      return publicFileToDataUri(pngSibling) ?? null;
    }
    const local = publicFileToDataUri(url);
    if (local && !isSvgSrc(url)) return local;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    if (contentType.includes("svg")) return null;
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    return toDataUri(buf, contentType);
  } catch {
    return null;
  }
}

export async function resolveHeroRasterSrc(
  preferred: string | null,
  fallbackPublicPath: string | null,
  origin: string
): Promise<string | null> {
  const candidates = [preferred, fallbackPublicPath].filter(Boolean) as string[];
  for (const src of candidates) {
    const absolute = src.startsWith("http") || src.startsWith("data:") || src.startsWith("/")
      ? src
      : `${origin}${src.startsWith("/") ? "" : "/"}${src}`;
    const raster = await fetchRasterDataUri(absolute.startsWith("/") && origin ? `${origin}${absolute}` : absolute);
    if (raster) return raster;
    if (src.startsWith("/")) {
      const local = publicFileToDataUri(isSvgSrc(src) ? src.replace(/\.svg(\?.*)?$/i, ".png") : src);
      if (local) return local;
    }
  }
  return fallbackPublicPath ? publicFileToDataUri(fallbackPublicPath.replace(/\.svg$/i, ".png")) : null;
}
