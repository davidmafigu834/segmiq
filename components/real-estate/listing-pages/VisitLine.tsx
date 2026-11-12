import { formatVisitDay, type DailyPoint } from "@/lib/real-estate/agent-listing-pages/analytics";

export function linePath(values: number[], width: number, height: number, pad = 2) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = pad + (height - pad * 2) - (value / max) * (height - pad * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

/** Read-only day line: ink stroke, faint area, lime dot on the last day. */
export function VisitDayLine({ days, label }: { days: DailyPoint[]; label: string }) {
  const visits = days.map((day) => day.visits);
  const max = Math.max(1, ...visits);
  const last = days[days.length - 1];
  if (!last) return null;
  return (
    <svg viewBox="0 0 640 132" className="mt-2 block h-auto w-full text-sales-text-primary" style={{ aspectRatio: "640 / 132" }} fontFamily="inherit" role="img" aria-label={label}>
      <line x1="28" x2="628" y1="18" y2="18" stroke="currentColor" className="text-sales-border" />
      <line x1="28" x2="628" y1="96" y2="96" stroke="currentColor" className="text-sales-border" />
      <text x="20" y="22" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{max}</text>
      <text x="20" y="100" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">0</text>
      <path d={`${linePath(visits, 600, 78)} L600,76 L0,76 Z`} transform="translate(28 18)" fill="currentColor" fillOpacity="0.08" />
      <path d={linePath(visits, 600, 78)} transform="translate(28 18)" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="628" cy={18 + 2 + 74 - (last.visits / max) * 74} r="3.5" fill="currentColor" className="text-sales-brand" />
      <text x="28" y="122" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[0].day)}</text>
      {days.length > 2 ? <text x="328" y="122" textAnchor="middle" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[Math.floor((days.length - 1) / 2)].day)}</text> : null}
      <text x="628" y="122" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(last.day)}</text>
    </svg>
  );
}

/** Short full-width day line for summary cards: no axis, lime dot on the last day. */
export function VisitStrip({ days, label }: { days: DailyPoint[]; label: string }) {
  const visits = days.map((day) => day.visits);
  const max = Math.max(1, ...visits);
  const last = days[days.length - 1];
  if (!last) return null;
  return (
    <svg viewBox="0 0 600 44" className="block h-auto w-full text-sales-text-primary" style={{ aspectRatio: "600 / 44" }} role="img" aria-label={label}>
      <line x1="0" x2="600" y1="40.5" y2="40.5" stroke="currentColor" className="text-sales-border" />
      <path d={`${linePath(visits, 592, 44, 4)} L592,40 L0,40 Z`} fill="currentColor" fillOpacity="0.08" />
      <path d={linePath(visits, 592, 44, 4)} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="592" cy={4 + 36 - (last.visits / max) * 36} r="3.5" fill="currentColor" className="text-sales-brand" />
    </svg>
  );
}

export function VisitSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  return (
    <svg viewBox="0 0 88 28" className="h-7 w-[88px] shrink-0 text-sales-text-primary" aria-hidden>
      <path d={linePath(values, 88, 28, 3)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
