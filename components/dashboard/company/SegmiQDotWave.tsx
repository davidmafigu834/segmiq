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

type Dot = { cx: number; cy: number; r: number; o: number; lime?: boolean; violet?: boolean };

function sampleBand(
  rng: () => number,
  band: { y: number; amp: number; freq: number; phase: number; x0: number; x1: number; weight: number }
): Dot[] {
  const dots: Dot[] = [];
  let i = 0;
  for (let x = band.x0; x <= band.x1; x += 26 + Math.round(rng() * 4)) {
    const y =
      band.y +
      band.amp * Math.sin(x * band.freq + band.phase) +
      band.amp * 0.26 * Math.sin(x * band.freq * 2.1 + band.phase * 0.55) +
      (rng() * 5 - 2.5);
    const edge = Math.min((x - band.x0) / 80, (band.x1 - x) / 90, 1);
    const o = Math.max(0.06, Math.min(0.15, band.weight * (0.4 + 0.6 * edge) * (0.7 + rng() * 0.3)));
    dots.push({
      cx: x + (rng() - 0.5) * 3.5,
      cy: y,
      r: 0.85 + rng() * 0.7,
      o,
      violet: i % 7 === 0,
    });
    i += 1;
  }
  return dots;
}

function buildField(seed: number, bands: Parameters<typeof sampleBand>[1][]): Dot[] {
  const rng = mulberry32(seed);
  const dots = bands.flatMap((band) => sampleBand(rng, band));
  const bright = dots.filter((d) => d.o > 0.11);
  if (bright[0]) bright[0].lime = true;
  if (bright[8]) bright[8].lime = true;
  return dots;
}

const TOP_RIGHT = buildField(19, [
  { y: 78, amp: 22, freq: 0.0082, phase: 0.4, x0: 40, x1: 560, weight: 0.7 },
  { y: 138, amp: 28, freq: 0.0074, phase: 1.15, x0: 20, x1: 560, weight: 0.85 },
  { y: 204, amp: 20, freq: 0.0078, phase: 0.2, x0: 70, x1: 560, weight: 0.55 },
]);

const BOTTOM_RIGHT = buildField(41, [
  { y: 90, amp: 18, freq: 0.0068, phase: 1.7, x0: 80, x1: 560, weight: 0.5 },
  { y: 156, amp: 24, freq: 0.0072, phase: 0.55, x0: 40, x1: 560, weight: 0.65 },
  { y: 228, amp: 16, freq: 0.008, phase: 2.05, x0: 120, x1: 560, weight: 0.4 },
]);

function DotField({ dots, className }: { dots: Dot[]; className: string }) {
  return (
    <svg className={className} viewBox="0 0 580 280" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      {dots.map((dot, i) => (
        <circle
          key={i}
          className={
            dot.lime ? "segmiq-dot segmiq-dot--lime" : dot.violet ? "segmiq-dot segmiq-dot--violet" : "segmiq-dot"
          }
          cx={dot.cx.toFixed(1)}
          cy={dot.cy.toFixed(1)}
          r={dot.r.toFixed(2)}
          opacity={dot.lime ? Math.min(dot.o, 0.12).toFixed(3) : dot.o.toFixed(3)}
        />
      ))}
    </svg>
  );
}

/** Sparse topographic dots for empty canvas regions. Decorative only. */
export function SegmiQDotWave() {
  return (
    <div className="segmiq-dot-wave" aria-hidden>
      <DotField dots={TOP_RIGHT} className="segmiq-dot-wave__tr" />
      <DotField dots={BOTTOM_RIGHT} className="segmiq-dot-wave__br" />
    </div>
  );
}
