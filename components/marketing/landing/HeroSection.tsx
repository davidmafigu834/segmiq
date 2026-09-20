import Link from "next/link";
import { ML } from "@/lib/marketing-links";
import AgenticHeroVisual from "@/components/marketing/landing/AgenticHeroVisual";

export default function HeroSection() {
  return (
    <section className="relative overflow-x-clip bg-[var(--marketing-bg)]" aria-labelledby="hero-heading">
      <div className="segmiq-shell pb-12 pt-6 sm:pb-16 sm:pt-8 lg:pb-20 lg:pt-10">
        <div className="segmiq-split">
          <div className="min-w-0">
            <h1
              id="hero-heading"
              className="max-w-[11ch] text-[40px] text-[var(--marketing-text-heading)] sm:text-[52px] lg:text-[64px]"
            >
              SegmiQ <span className="lime">Agentic AI</span>
            </h1>
            <p className="mt-5 max-w-[38ch] text-[16px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[17px]">
              Answers WhatsApp, qualifies the lead, prepares the quote, and follows up. A person steps in when judgement is required.
            </p>
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={ML.contact}
                className="segmiq-btn-primary inline-flex h-11 min-h-11 items-center justify-center bg-[var(--marketing-brand)] px-5 text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] sm:h-12"
              >
                Book a demo
              </Link>
              <Link
                href={ML.agentic}
                className="segmiq-btn-secondary inline-flex h-11 min-h-11 items-center justify-center px-5 text-[14px] font-semibold sm:h-12"
              >
                See Agentic AI
              </Link>
            </div>
          </div>

          <div className="relative min-w-0 pb-14 sm:pb-10 lg:pb-4">
            <div
              role="img"
              aria-label="SegmiQ Agent answering a WhatsApp solar enquiry and updating the CRM: catalogue lookup, qualification, quotation and follow-up."
            >
              <AgenticHeroVisual />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
