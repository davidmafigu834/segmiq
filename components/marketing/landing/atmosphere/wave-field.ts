/** Deterministic PRNG so SSR and client paint the same field. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type AtmosphereTone =
  | "hero"
  | "proof"
  | "agentic"
  | "brain"
  | "workflow"
  | "platform"
  | "showcase"
  | "industry"
  | "story"
  | "cta"
  | "footer";

export type WaveDot = {
  cx: number;
  cy: number;
  r: number;
  o: number;
  lime?: boolean;
  fine?: boolean;
};

type WaveBand = {
  y: number;
  amp: number;
  freq: number;
  phase: number;
  weight: number;
  x0?: number;
  x1?: number;
};

type Ring = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  count: number;
  start: number;
  sweep: number;
  weight: number;
};

type ToneSpec = {
  seed: number;
  bands: WaveBand[];
  rings?: Ring[];
  trails: string[];
  lime: number;
  glow: "right" | "center" | "left" | "split" | "bottom" | "none";
  reflect: "right" | "center" | "left" | "wide" | "none";
};

const VB = { w: 1200, h: 720 };

const TONES: Record<AtmosphereTone, ToneSpec> = {
  hero: {
    seed: 11,
    glow: "right",
    reflect: "right",
    lime: 3,
    bands: [
      { y: 168, amp: 36, freq: 0.0084, phase: 0.4, weight: 0.55, x0: 430 },
      { y: 248, amp: 42, freq: 0.0076, phase: 1.1, weight: 0.85, x0: 380 },
      { y: 328, amp: 48, freq: 0.007, phase: 0.2, weight: 1, x0: 360 },
      { y: 412, amp: 40, freq: 0.0066, phase: 1.8, weight: 0.9, x0: 400 },
      { y: 492, amp: 34, freq: 0.0078, phase: 0.7, weight: 0.7, x0: 480 },
      { y: 572, amp: 26, freq: 0.0088, phase: 2.2, weight: 0.45, x0: 560 },
    ],
    trails: [
      "M420 560C560 470 720 310 980 168C1060 118 1130 86 1188 64",
      "M390 620C540 520 780 360 1040 240",
      "M640 680C780 540 900 380 1120 220",
    ],
  },
  proof: {
    seed: 21,
    glow: "none",
    reflect: "none",
    lime: 0,
    bands: [
      { y: 220, amp: 18, freq: 0.0055, phase: 0.3, weight: 0.35 },
      { y: 340, amp: 22, freq: 0.0048, phase: 1.4, weight: 0.4 },
      { y: 470, amp: 16, freq: 0.0052, phase: 0.8, weight: 0.28 },
    ],
    trails: [],
  },
  agentic: {
    seed: 31,
    glow: "split",
    reflect: "right",
    lime: 4,
    bands: [
      { y: 150, amp: 30, freq: 0.009, phase: 0.6, weight: 0.5, x0: 420 },
      { y: 240, amp: 44, freq: 0.0074, phase: 1.7, weight: 0.95, x0: 360 },
      { y: 340, amp: 52, freq: 0.0068, phase: 0.15, weight: 1, x0: 340 },
      { y: 440, amp: 40, freq: 0.0072, phase: 2.1, weight: 0.85, x0: 380 },
      { y: 540, amp: 28, freq: 0.0082, phase: 0.9, weight: 0.55, x0: 460 },
    ],
    trails: [
      "M280 420C420 300 610 240 820 210C940 194 1060 170 1160 120",
      "M340 580C520 470 740 330 1020 250",
      "M200 260C360 220 520 280 700 250C860 222 1000 160 1140 90",
    ],
  },
  brain: {
    seed: 41,
    glow: "center",
    reflect: "center",
    lime: 2,
    bands: [],
    rings: [
      { cx: 600, cy: 300, rx: 168, ry: 118, count: 28, start: -0.2, sweep: 6.6, weight: 0.55 },
      { cx: 600, cy: 300, rx: 228, ry: 168, count: 36, start: 0.4, sweep: 6.1, weight: 0.75 },
      { cx: 600, cy: 300, rx: 298, ry: 224, count: 42, start: -0.6, sweep: 6.8, weight: 0.5 },
      { cx: 600, cy: 300, rx: 372, ry: 278, count: 34, start: 0.8, sweep: 5.4, weight: 0.32 },
    ],
    trails: [
      "M320 180C420 120 520 110 600 160",
      "M880 180C780 120 680 110 600 160",
      "M340 460C440 540 520 560 600 500",
    ],
  },
  workflow: {
    seed: 51,
    glow: "split",
    reflect: "wide",
    lime: 1,
    bands: [
      { y: 180, amp: 24, freq: 0.0062, phase: 0.5, weight: 0.4 },
      { y: 300, amp: 32, freq: 0.0056, phase: 1.6, weight: 0.62 },
      { y: 430, amp: 28, freq: 0.006, phase: 0.2, weight: 0.5 },
      { y: 560, amp: 20, freq: 0.007, phase: 2.0, weight: 0.32 },
    ],
    trails: ["M80 380C260 300 480 340 720 280C920 230 1060 250 1180 200"],
  },
  platform: {
    seed: 61,
    glow: "bottom",
    reflect: "wide",
    lime: 0,
    bands: [
      { y: 360, amp: 16, freq: 0.0044, phase: 0.4, weight: 0.42 },
      { y: 460, amp: 20, freq: 0.004, phase: 1.2, weight: 0.55 },
      { y: 560, amp: 14, freq: 0.0048, phase: 0.1, weight: 0.38 },
      { y: 640, amp: 10, freq: 0.005, phase: 1.8, weight: 0.24 },
    ],
    trails: ["M60 520C300 470 600 500 900 460C1040 440 1140 430 1200 410"],
  },
  showcase: {
    seed: 71,
    glow: "bottom",
    reflect: "wide",
    lime: 1,
    bands: [
      { y: 400, amp: 18, freq: 0.005, phase: 0.7, weight: 0.45 },
      { y: 510, amp: 22, freq: 0.0046, phase: 1.5, weight: 0.6 },
      { y: 610, amp: 14, freq: 0.0054, phase: 0.3, weight: 0.35 },
    ],
    trails: ["M40 560C280 500 620 540 960 500C1080 482 1160 470 1200 455"],
  },
  industry: {
    seed: 81,
    glow: "right",
    reflect: "right",
    lime: 1,
    bands: [
      { y: 200, amp: 22, freq: 0.0064, phase: 0.9, weight: 0.35, x0: 520 },
      { y: 320, amp: 30, freq: 0.0058, phase: 0.2, weight: 0.5, x0: 500 },
      { y: 450, amp: 24, freq: 0.006, phase: 1.7, weight: 0.4, x0: 560 },
      { y: 580, amp: 16, freq: 0.007, phase: 0.5, weight: 0.28, x0: 620 },
    ],
    trails: ["M540 520C680 400 840 280 1080 180"],
  },
  story: {
    seed: 91,
    glow: "left",
    reflect: "left",
    lime: 0,
    bands: [
      { y: 240, amp: 16, freq: 0.005, phase: 0.4, weight: 0.3, x1: 620 },
      { y: 380, amp: 20, freq: 0.0046, phase: 1.3, weight: 0.38, x1: 640 },
      { y: 530, amp: 14, freq: 0.0052, phase: 0.8, weight: 0.24, x1: 580 },
    ],
    trails: ["M40 420C180 340 320 300 480 280"],
  },
  cta: {
    seed: 101,
    glow: "split",
    reflect: "wide",
    lime: 3,
    bands: [
      { y: 160, amp: 34, freq: 0.0076, phase: 0.3, weight: 0.55 },
      { y: 280, amp: 42, freq: 0.0068, phase: 1.4, weight: 0.85 },
      { y: 410, amp: 36, freq: 0.0072, phase: 0.6, weight: 0.7 },
      { y: 540, amp: 24, freq: 0.008, phase: 2.0, weight: 0.45 },
    ],
    trails: [
      "M40 200C220 140 420 180 640 120C820 70 980 90 1180 40",
      "M80 560C300 470 560 500 860 420C1000 380 1120 340 1200 300",
    ],
  },
  footer: {
    seed: 111,
    glow: "none",
    reflect: "none",
    lime: 0,
    bands: [
      { y: 120, amp: 12, freq: 0.0042, phase: 0.5, weight: 0.22 },
      { y: 220, amp: 10, freq: 0.0048, phase: 1.1, weight: 0.16 },
    ],
    trails: [],
  },
};

function sampleBand(band: WaveBand, rng: () => number, step: number): WaveDot[] {
  const dots: WaveDot[] = [];
  const x0 = band.x0 ?? 40;
  const x1 = band.x1 ?? VB.w - 40;
  let i = 0;
  for (let x = x0; x <= x1; x += step) {
    const wobble = rng() * 6 - 3;
    const y =
      band.y +
      band.amp * Math.sin(x * band.freq + band.phase) +
      band.amp * 0.28 * Math.sin(x * band.freq * 2.15 + band.phase * 0.6) +
      wobble;
    const edge = Math.min((x - x0) / 90, (x1 - x) / 110, 1);
    const o = Math.max(0.08, band.weight * (0.35 + 0.65 * edge) * (0.72 + rng() * 0.28));
    const r = 1.05 + rng() * 1.35 * band.weight;
    dots.push({ cx: x + (rng() - 0.5) * 4, cy: y, r, o, fine: i % 2 === 1 });
    i += 1;
  }
  return dots;
}

function sampleRing(ring: Ring, rng: () => number): WaveDot[] {
  const dots: WaveDot[] = [];
  for (let i = 0; i < ring.count; i++) {
    const t = i / ring.count;
    const a = ring.start + ring.sweep * t;
    const jitter = 1 + (rng() - 0.5) * 0.06;
    const cx = ring.cx + ring.rx * Math.cos(a) * jitter;
    const cy = ring.cy + ring.ry * Math.sin(a) * jitter;
    const o = ring.weight * (0.4 + rng() * 0.5);
    dots.push({
      cx,
      cy,
      r: 1.1 + rng() * 1.2,
      o,
      fine: i % 3 === 0,
    });
  }
  return dots;
}

export function buildWaveField(tone: AtmosphereTone): {
  dots: WaveDot[];
  trails: string[];
  glow: ToneSpec["glow"];
  reflect: ToneSpec["reflect"];
} {
  const spec = TONES[tone];
  const rng = mulberry32(spec.seed);
  const step = tone === "hero" || tone === "agentic" || tone === "cta" ? 22 : 28;
  const dots: WaveDot[] = [];

  for (const band of spec.bands) {
    dots.push(...sampleBand(band, rng, step + Math.round(rng() * 4)));
  }
  for (const ring of spec.rings ?? []) {
    dots.push(...sampleRing(ring, rng));
  }

  const candidates = dots.filter((d) => d.o > 0.45 && d.r > 1.4);
  for (let i = 0; i < spec.lime && candidates.length; i++) {
    const pick = candidates[Math.floor(rng() * candidates.length)];
    if (pick) pick.lime = true;
  }

  return { dots, trails: spec.trails, glow: spec.glow, reflect: spec.reflect };
}

export const WAVE_VIEWBOX = `0 0 ${VB.w} ${VB.h}`;
