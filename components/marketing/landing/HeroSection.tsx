import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ML } from "@/lib/marketing-links";
import HeroTrustPoints from "@/components/marketing/landing/HeroTrustPoints";
import AgenticHeroVisual from "@/components/marketing/landing/AgenticHeroVisual";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

export default function HeroSection() {
  return (
    <section
      className="marketing-halo marketing-halo--hero relative overflow-x-clip bg-[var(--marketing-bg)]"
      aria-labelledby="hero-heading"
    >
      <SegmiQSectionAtmosphere tone="hero" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-8 sm:px-10 sm:pb-16 sm:pt-9 lg:px-12 lg:pb-[72px] lg:pt-10">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:gap-10 xl:gap-12">
          <div className="segmiq-hero-copy relative mx-auto max-w-[540px] text-center lg:mx-0 lg:text-left">
            <p className="segmiq-kicker text-[11px] text-[var(--marketing-olive)] sm:text-[12px]">
              Introducing
            </p>
            <h1
              id="hero-heading"
              className="mt-2.5 text-[40px] text-[var(--marketing-text-heading)] sm:text-[52px] md:text-[58px] lg:text-[64px] xl:text-[72px]"
            >
              SegmiQ{" "}
              <span className="lime">Agentic AI</span>
            </h1>

            <p className="mx-auto mt-5 max-w-[480px] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[16px] lg:mx-0">
              The agent that answers WhatsApp enquiries, qualifies the opportunity, prepares the
              quote and follows up — then briefs a human when judgement is required.
            </p>
            <p className="mx-auto mt-2.5 max-w-[480px] text-[14px] leading-[1.6] text-[var(--marketing-text-muted)] lg:mx-0">
              Built for service businesses in Africa, on the revenue OS your team already runs.
            </p>

            <div className="mt-5 flex flex-col items-center gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <Link
                href={ML.contact}
                className="segmiq-btn-primary inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] px-5 text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] sm:h-12 sm:w-auto"
              >
                Book a demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={ML.agentic}
                className="inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-surface)] px-5 text-[14px] font-semibold text-[var(--marketing-text)] backdrop-blur-md transition-colors hover:bg-[var(--marketing-hover)] sm:h-12 sm:w-auto"
              >
                See Agentic AI
              </Link>
            </div>

            <HeroTrustPoints />
          </div>

          <div className="relative min-w-0 pb-16 sm:pb-12 lg:pb-6">
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
