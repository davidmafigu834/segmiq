import { readFile } from "fs/promises";
import { join } from "path";

export async function getOgWordmarkDataUrl() {
  const buf = await readFile(join(process.cwd(), "public/segmiq-wordmark.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function getOgMarkDataUrl() {
  const buf = await readFile(join(process.cwd(), "public/brand/segmiq-q.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}
