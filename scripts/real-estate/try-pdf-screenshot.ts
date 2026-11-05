import { readFileSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

const files = [
  "synthetic-individual-open.pdf",
  "synthetic-company-open.pdf",
  "synthetic-sole-continuation.pdf",
];

async function main() {
  for (const file of files) {
    const bytes = readFileSync(`docs/verification/samples/${file}`);
    const parser = new PDFParse({ data: bytes });
    const shot = await parser.getScreenshot({ imageBuffer: true, scale: 1.5 });
    console.log(file, shot.total, shot.pages.map((page: { pageNumber?: number; data?: Uint8Array }) => page.data?.length ?? 0).join(","));
    shot.pages.forEach((page: { pageNumber: number; data?: Uint8Array }, index: number) => {
      if (!page.data) return;
      writeFileSync(`docs/verification/samples/${file.replace(".pdf", "")}-page-${page.pageNumber || index + 1}.png`, Buffer.from(page.data));
    });
  }
}

void main();
