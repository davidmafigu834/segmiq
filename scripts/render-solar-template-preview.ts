import React from "react";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

(globalThis as { React?: typeof React }).React = React;

async function main() {
  const { solarTemplateFixture } = await import("../lib/quotations/layouts/fixtures");
  const { renderLayoutPdf } = await import("../lib/quotations/layouts/residential-premium-solar-pdf");
  const outDir = path.join(process.cwd(), "tmp", "solar-template");
  mkdirSync(outDir, { recursive: true });
  for (const kind of ["populated", "minimal", "long", "multipage"] as const) {
    const buffer = await renderLayoutPdf(solarTemplateFixture(kind));
    const file = path.join(outDir, `${kind}.pdf`);
    writeFileSync(file, buffer);
    console.log(`wrote ${file} (${buffer.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
