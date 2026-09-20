import Link from "next/link";
import { ML } from "@/lib/marketing-links";

export default function FinalCTASection() {
  return (
    <section className="bg-[var(--marketing-bg)]" aria-labelledby="final-cta-heading">
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 lg:pb-24">
        <h2
          id="final-cta-heading"
          className="max-w-[16ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[46px]"
        >
          Ready to see SegmiQ Agentic AI?
        </h2>
        <p className="mt-4 max-w-[42ch] text-[16px] leading-[1.55] text-[var(--marketing-text-secondary)]">
          Book a personalised demo and watch SegmiQ Agent handle a real enquiry. Then see where your
          team stays in control.
        </p>
        <div className="mt-8">
          <Link
            href={ML.contact}
            className="segmiq-btn-primary inline-flex h-12 min-h-12 items-center justify-center bg-[var(--marketing-brand)] px-6 text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)]"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
