import Link from "next/link";
import { ArrowRight, CalendarDays, Check } from "lucide-react";
import { ML } from "@/lib/marketing-links";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

function DemoPreviewCard() {
  return (
    <div
      className="mx-auto w-full rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-4 sm:w-[240px] sm:shrink-0 lg:mx-0"
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--marketing-hover)] text-[var(--marketing-text)]">
          <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div>
          <p className="segmiq-kicker text-[11px] text-[var(--marketing-text-muted)]">
            SegmiQ demo
          </p>
          <p className="text-[13px] font-semibold text-[var(--marketing-text)]">30 min</p>
        </div>
      </div>

      <ul className="mt-3.5 space-y-2">
        {["See Agentic AI", "Ask about Company Brain", "Plan your setup"].map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-[12px] font-medium text-[var(--marketing-text-label)]"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#D4FF4F]">
              <Check className="h-2.5 w-2.5 text-[#101828]" strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dark: glass panel, light type, lime CTA. Light: lime panel, dark type. */
export default function FinalCTASection() {
  return (
    <section
      className="marketing-halo marketing-halo--cta bg-[var(--marketing-bg)]"
      aria-labelledby="final-cta-heading"
    >
      <SegmiQSectionAtmosphere tone="cta" />
      <div className="mx-auto max-w-[1280px] px-6 pb-12 pt-12 sm:px-10 sm:pb-14 sm:pt-14 lg:px-12 lg:pb-16 lg:pt-16">
        <div className="segmiq-cta-panel relative overflow-hidden rounded-2xl px-5 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_auto] lg:gap-10">
            <div className="min-w-0 text-center lg:text-left">
              <p className="segmiq-kicker text-[10px] text-[var(--marketing-olive)] sm:text-[11px]">
                Ready to see Agentic AI
              </p>
              <h2
                id="final-cta-heading"
                className="mx-auto mt-2.5 max-w-[680px] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:mx-0 lg:text-[46px]"
              >
                Ready to see SegmiQ Agentic AI?
              </h2>
              <p className="mx-auto mt-3 max-w-[640px] text-[14px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:mt-3.5 sm:text-[15px] lg:mx-0 lg:text-[16px]">
                Book a personalised demo and watch SegmiQ Agent handle a real enquiry — then see
                where your team stays in control.
              </p>

              <div className="mt-6 flex flex-col items-center gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start sm:gap-4">
                <Link
                  href={ML.contact}
                  className="segmiq-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] px-6 text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] sm:h-[52px] sm:w-auto sm:px-7"
                >
                  Book a demo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={ML.agentic}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--marketing-link)] transition-colors hover:text-[var(--marketing-link-hover)] sm:text-[14px]"
                >
                  See Agentic AI
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>

              <p className="mt-3.5 text-[12px] leading-snug text-[var(--marketing-text-muted)]">
                No pressure. See how SegmiQ Agent would sell for your business.
              </p>
            </div>

            <DemoPreviewCard />
          </div>
        </div>
      </div>
    </section>
  );
}
