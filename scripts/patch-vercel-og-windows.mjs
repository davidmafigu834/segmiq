/**
 * Next.js 14.2.35 loads the Open Graph runtime with
 * fileURLToPath(path.join(import.meta.url, "../asset")).
 * On Windows, path.join rewrites a file URL into ".\file:\D:\...",
 * and fileURLToPath throws TypeError: Invalid URL while prerendering
 * /opengraph-image. Linux path.join keeps a valid file URL, which is
 * why the Vercel build does not hit this.
 *
 * new URL("./asset", import.meta.url) resolves beside index.node.js
 * on both platforms. This rewrite runs only on win32 and only when the
 * broken call is still present, so a future Next release is left alone.
 */
import fs from "node:fs";

const file = "node_modules/next/dist/compiled/@vercel/og/index.node.js";

if (process.platform !== "win32" || !fs.existsSync(file)) {
  process.exit(0);
}

const replacements = [
  [
    'fileURLToPath(join(import.meta.url, "../noto-sans-v27-latin-regular.ttf"))',
    'fileURLToPath(new URL("./noto-sans-v27-latin-regular.ttf", import.meta.url))',
  ],
  [
    'fileURLToPath(join(import.meta.url, "../yoga.wasm"))',
    'fileURLToPath(new URL("./yoga.wasm", import.meta.url))',
  ],
  [
    'fileURLToPath(join(import.meta.url, "../resvg.wasm"))',
    'fileURLToPath(new URL("./resvg.wasm", import.meta.url))',
  ],
];

let source = fs.readFileSync(file, "utf8");
let changed = 0;
for (const [from, to] of replacements) {
  if (!source.includes(from)) continue;
  source = source.replace(from, to);
  changed += 1;
}

if (changed > 0) {
  fs.writeFileSync(file, source);
  console.log(`Patched @vercel/og Windows asset paths (${changed}).`);
}
