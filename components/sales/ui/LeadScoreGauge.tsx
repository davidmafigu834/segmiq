import { cn } from "@/lib/ui/cn";

/** Prominent circular score visualization — use sparingly (detail/insight surfaces). */
export function LeadScoreGauge({
  score,
  className,
  size = 88,
}: {
  score: number | null | undefined;
  className?: string;
  size?: number;
}) {
  if (score == null || !Number.isFinite(score)) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const band = clamped >= 70 ? "hot" : clamped >= 45 ? "warm" : "cold";
  const label = band === "hot" ? "Hot" : band === "warm" ? "Warm" : "Cold";
  const stroke =
    band === "hot"
      ? "var(--sales-danger)"
      : band === "warm"
        ? "var(--sales-warning)"
        : "var(--sales-info)";

  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-1", className)}
      role="img"
      aria-label={`Lead score ${clamped} out of 100. ${label}.`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--sales-border-subtle)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-sales-text-primary text-[18px] font-semibold"
        >
          {clamped}
        </text>
      </svg>
      <p className="text-[12px] font-medium text-sales-text-secondary">
        {label} lead
      </p>
    </div>
  );
}
