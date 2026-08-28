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

function buildWave(
  seed: number,
  opts: { rows: number; y0: number; amp: number; freq: number; phase: number }
): Dot[] {
  const rng = mulberry32(seed);
  const dots: Dot[] = [];
  const x0 = 6;
  const x1 = 574;
  const step = 16;
  for (let row = 0; row < opts.rows; row++) {
    const yBase = opts.y0 + row * 15.2;
    const amp = opts.amp + (row % 4) * 2.4;
    const freq = opts.freq + row * 0.00028;
    const phase = opts.phase + row * 0.38;
    const offset = (row % 2) * (step / 2);
    let col = 0;
    for (let x = x0 + offset; x <= x1; x += step) {
      const y =
        yBase +
        amp * Math.sin(x * freq + phase) +
        amp * 0.28 * Math.sin(x * freq * 2.05 + phase * 0.62) +
        (rng() - 0.5) * 1.8;
      const nx = (x - x0) / (x1 - x0);
      const ny = opts.rows <= 1 ? 1 : row / (opts.rows - 1);
      const edge = Math.min(nx * 3.6, (1 - nx) * 2.8, ny * 2.4, (1 - ny) * 2.2, 1);
      const o = Math.max(0.2, Math.min(0.34, 0.21 + 0.13 * edge * (0.82 + rng() * 0.18)));
      dots.push({
        cx: x + (rng() - 0.5) * 2.1,
        cy: y,
        r: 0.7 + rng() * 0.5,
        o,
        violet: (row + col) % 3 !== 1,
      });
      col += 1;
    }
  }
  const mid = dots.filter((d) => d.o > 0.28);
  if (mid[4]) mid[4].lime = true;
  if (mid[21]) mid[21].lime = true;
  return dots;
}

const TOP_RIGHT = buildWave(19, { rows: 15, y0: 18, amp: 20, freq: 0.0108, phase: 0.45 });
const BOTTOM_RIGHT = buildWave(41, { rows: 14, y0: 22, amp: 17, freq: 0.0096, phase: 1.62 });

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
          opacity={dot.lime ? "0.16" : dot.o.toFixed(3)}
        />
      ))}
    </svg>
  );
}

/** Flowing sinusoidal dot-wave for empty canvas regions. Decorative only. */
export function SegmiQDotWave() {
  return (
    <div className="segmiq-dot-wave" aria-hidden>
      <DotField dots={TOP_RIGHT} className="segmiq-dot-wave__tr" />
      <DotField dots={BOTTOM_RIGHT} className="segmiq-dot-wave__br" />
    </div>
  );
}
