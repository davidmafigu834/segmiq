import { readFile } from "fs/promises";
import { join } from "path";

export async function getOgWordmarkDataUrl() {
  const buf = await readFile(join(process.cwd(), "public/segmiq-wordmark.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}
