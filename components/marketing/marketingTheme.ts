/** Dark marketing site theme — used across app/(marketing) */

export const MARKETING_GLOW_STYLE = {
  backgroundImage: `
    radial-gradient(circle at 50% 100%, rgba(212, 255, 79, 0.42) 0%, transparent 55%),
    radial-gradient(circle at 50% 100%, rgba(212, 255, 79, 0.2) 0%, transparent 68%),
    radial-gradient(circle at 50% 100%, rgba(212, 255, 79, 0.08) 0%, transparent 82%)
  `,
} as const;

/** Brand accent (lime) reused in inline styles/shadows. */
export const ACCENT = "#D4FF4F";

export const m = {
  page: "text-white",
  muted: "text-white/65",
  faint: "text-white/45",
  border: "border-white/10",
  ring: "ring-white/10",
  kicker: "text-xs tracking-widest font-semibold text-white/45",
  panel: "rounded-2xl border border-white/10 bg-white/[0.04] p-6",
  card: "rounded-xl border border-white/10 bg-white/[0.03] p-4",
  cardHover: "rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-transform duration-300 hover:-translate-y-1",
  cardIcon: "rounded-xl bg-white/[0.06]",
  ghostBtn: "rounded-full border border-white/20 font-semibold hover:border-white/40",

  /* ---------- enterprise UI system (ServiceNow-grade polish) ---------- */
  /** Small uppercase section label. */
  eyebrow:
    "inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#D4FF4F]",
  /** Pill chip used for the eyebrow when it needs a container. */
  eyebrowChip:
    "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4FF4F] backdrop-blur",

  /** Primary action — lime fill, animated glow halo + shine sweep on hover. */
  btnPrimary:
    "mk-btn-glow inline-flex items-center justify-center gap-1.5 rounded-full bg-[#D4FF4F] px-5 py-2.5 text-sm font-semibold text-black transition-transform duration-200 hover:bg-[#c8f040] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF4F]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] active:translate-y-0",
  /** Secondary action — glass border that lights up lime on hover. */
  btnSecondary:
    "group/btn relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:border-[#D4FF4F]/50 hover:bg-white/[0.09] hover:shadow-[0_0_24px_-8px_rgba(212,255,79,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
  /** Action on a light/lime surface — black fill with a shine sweep. */
  btnOnLight:
    "mk-shine relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-[#D4FF4F] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_-12px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
  /** Text/inline link button with arrow. */
  btnLink:
    "inline-flex items-center gap-1 text-sm font-semibold text-[#D4FF4F] transition-colors hover:text-[#e4ff8a]",

  /** Interactive surface card — gradient fill, glow + lift on hover. */
  surface:
    "group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.015] transition-all duration-300 hover:-translate-y-1 hover:border-[#D4FF4F]/30 hover:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.7)]",
  /** Static glass panel. */
  glass:
    "rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-sm",
  /** Icon tile inside cards. */
  iconTile:
    "grid place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-[#D4FF4F]",
  /** Hairline gradient divider. */
  divider:
    "h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent",
  pill: "inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 max-w-full rounded-full border border-white/15 bg-white/[0.05] px-3 sm:px-4 py-2.5 text-xs sm:text-[13px] leading-snug text-center hover:border-white/30",
  chip: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] text-white/65 text-[13px] font-semibold",
  highlight: "text-[#D4FF4F]",
  inlineLink: "text-white underline decoration-[#D4FF4F] decoration-2",
  linkMuted: "text-white/65 hover:text-white",
  iconBtn: "w-9 h-9 rounded-full border border-white/15 grid place-items-center text-white/60 hover:border-white/30",
  sectionBand: "border-t border-white/10",
  elevated: "rounded-xl bg-[#181818] border border-white/10",
  pricingCard: "rounded-2xl p-6 bg-white/[0.04] border border-white/10",
  pricingLabel: "text-white/45",
  pricingSub: "text-white/55",
  pricingGhost: "border border-white/15 hover:border-white/30",
  field: "w-full border border-white/10 rounded-xl px-3.5 py-2.5 text-sm bg-white/[0.04] text-white outline-none focus:border-white/30 transition-colors placeholder:text-white/40",
  tableWrap: "overflow-x-auto rounded-2xl border border-white/10",
  tableHead: "bg-white/[0.04] text-left",
  tableRowAlt: "bg-white/[0.02]",
  filterOn: "bg-[#D4FF4F] text-black border-[#D4FF4F]",
  filterOff: "border-white/10 text-white/65 hover:border-white/30 hover:text-white",
  legalProse:
    "[&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-white/65 [&_p]:mt-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mt-2.5 [&_ul]:text-[15px] [&_ul]:leading-[1.7] [&_ul]:text-white/65 [&_li]:mt-1 [&_a]:text-white [&_a]:underline [&_strong]:text-white",
} as const;
