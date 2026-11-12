const PORTRAITS = [
  { wash: "#f3c1d3", ink: "#8d3d5c" },
  { wash: "#b7d2f6", ink: "#2a4f86" },
  { wash: "#d5d8df", ink: "#4c5566" },
  { wash: "#f0d2bc", ink: "#8a4d2e" },
  { wash: "#c9d7c4", ink: "#3c5342" },
  { wash: "#ddc8f0", ink: "#5c3d7a" },
];

const MARKS = [
  ["#314e89", "#f0b7c8"],
  ["#2f6d73", "#f0c89a"],
  ["#5c3d6e", "#e7c0d4"],
  ["#3e4c63", "#c9d6ea"],
  ["#7a4638", "#f0d2bf"],
  ["#3d5648", "#d5e2c6"],
];

function hash(seed: string) {
  let value = 2166136261;
  const text = seed.trim().toLowerCase() || "account";
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function AbstractMark({ seed }: { seed: string }) {
  const value = hash(seed);
  const [base, accent] = MARKS[value % MARKS.length]!;
  const variant = (value >> 8) % 4;
  return (
    <span className="re-sb-mark" aria-hidden>
      <svg viewBox="0 0 26 26" width="26" height="26">
        <rect width="26" height="26" fill={base} />
        {variant === 0 ? <circle cx="18" cy="9" r="8" fill={accent} /> : null}
        {variant === 1 ? <path d="M0 14 L26 4 V26 H0 Z" fill={accent} /> : null}
        {variant === 2 ? <rect x="3" y="3" width="11" height="20" fill={accent} /> : null}
        {variant === 3 ? <circle cx="8" cy="18" r="9" fill={accent} /> : null}
      </svg>
    </span>
  );
}

export function PixelPortrait({ seed }: { seed: string }) {
  const value = hash(`${seed} portrait`);
  const tone = PORTRAITS[value % PORTRAITS.length]!;
  const columns: boolean[][] = [];
  let filled = 0;
  for (let row = 0; row < 5; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < 3; col += 1) {
      const on = ((value >> (row * 3 + col + 4)) & 1) === 1;
      line.push(on);
      if (on) filled += 1;
    }
    columns.push(line);
  }
  if (filled < 4) {
    columns[1]![1] = true;
    columns[2]![0] = true;
    columns[2]![2] = true;
    columns[3]![1] = true;
  }
  const cells = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const source = col < 3 ? col : 4 - col;
      if (!columns[row]![source]) continue;
      cells.push(<rect key={`${row}-${col}`} x={col} y={row} width="1" height="1" />);
    }
  }
  return (
    <span className="re-sb-avatar" style={{ background: tone.wash }} aria-hidden>
      <svg viewBox="0 0 5 5" width="18" height="18" shapeRendering="crispEdges">
        <g fill={tone.ink}>{cells}</g>
      </svg>
    </span>
  );
}
