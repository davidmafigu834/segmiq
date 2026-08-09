import { Check } from "lucide-react";

const POINTS = ["Quick to set up", "Teams love it", "Built for Africa"] as const;

export default function HeroTrustPoints() {
  return (
    <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-6 sm:gap-x-6">
      {POINTS.map((label) => (
        <li
          key={label}
          className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--marketing-text-secondary)]"
        >
          <span
            className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[var(--marketing-border-strong)]"
            aria-hidden
          >
            <Check
              className="h-[11px] w-[11px] text-[var(--marketing-trust-check)]"
              strokeWidth={2.5}
            />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
