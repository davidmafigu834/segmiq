/** Dark marketing site theme — used across app/(marketing) */

export const MARKETING_GLOW_STYLE = {
  backgroundImage: `
    radial-gradient(circle at 50% 100%, rgba(212, 255, 79, 0.42) 0%, transparent 55%),
    radial-gradient(circle at 50% 100%, rgba(212, 255, 79, 0.2) 0%, transparent 68%),
    radial-gradient(circle at 50% 100%, rgba(212, 255, 79, 0.08) 0%, transparent 82%)
  `,
} as const;

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
  pill: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-[13px] hover:border-white/30",
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
