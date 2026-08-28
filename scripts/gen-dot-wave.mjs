import fs from "node:fs";
import path from "node:path";

function wave(seed, opts) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const { rows, y0, amp0, freq, phase, w, h, step, rowGap } = opts;
  const parts = [];
  const colors = ["#e9d5ff", "#d8b4fe", "#c4b5fd", "#a78bfa", "#8b5cf6"];
  for (let row = 0; row < rows; row++) {
    const yBase = y0 + row * rowGap;
    const amp = amp0 + Math.sin(row * 0.38) * 8;
    const off = (row % 2) * (step / 2);
    for (let x = 8 + off; x <= w - 8; x += step) {
      const y =
        yBase +
        amp * Math.sin(x * freq + phase + row * 0.32) +
        amp * 0.22 * Math.sin(x * freq * 2.05 + row * 0.5);
      const nx = x / w;
      const ny = row / Math.max(1, rows - 1);
      const fadeL = 0.88 + 0.12 * nx;
      const fadeBottom = Math.max(0, 1 - Math.pow(ny, 1.45));
      const o = (0.28 + 0.5 * fadeL * fadeBottom) * (0.92 + rng() * 0.08);
      if (o < 0.12) continue;
      const r = 0.8 + rng() * 0.55;
      const c = colors[(row + Math.round(x / step)) % colors.length];
      parts.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" opacity="${Math.min(0.84, o).toFixed(3)}"/>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none">${parts.join("")}</svg>`;
}

const dir = path.resolve("public/segmiq");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "dot-wave-violet.svg"),
  wave(19, { rows: 24, y0: 6, amp0: 20, freq: 0.0072, phase: 0.4, w: 1600, h: 360, step: 7, rowGap: 14 }),
);
console.log("wrote", fs.statSync(path.join(dir, "dot-wave-violet.svg")).size);
