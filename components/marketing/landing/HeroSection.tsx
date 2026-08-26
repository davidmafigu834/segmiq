import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { ML } from "@/lib/marketing-links";
import HeroTrustPoints from "@/components/marketing/landing/HeroTrustPoints";
import ProductHeroVisual from "@/components/marketing/landing/ProductHeroVisual";

export default function HeroSection() {
  return (
    <section
      className="marketing-halo marketing-halo--hero relative overflow-x-clip bg-[var(--marketing-bg)]"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-9 lg:px-12 lg:pb-11 lg:pt-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:gap-10 xl:gap-12">
          {/* Copy column */}
          <div className="segmiq-hero-copy relative z-10 max-w-[520px]">
            <h1
              id="hero-heading"
              className="text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--marketing-text-heading)] sm:text-[40px] sm:leading-[1.04] md:text-[44px] lg:text-[46px] xl:text-[48px] xl:leading-[1.02]"
              style={{ fontWeight: 650 }}
            >
              The revenue operating system for service businesses in{" "}
              <span className="text-[var(--marketing-accent-text)]">Africa</span>
            </h1>

            <p className="mt-4 max-w-[480px] text-[15px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[16px]">
              Capture enquiries from WhatsApp, Facebook ads and real-world channels. Qualify
              leads, follow up, close deals, and document work — all in one system your team will
              actually use.
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                href={ML.contact}
                className="segmiq-btn-primary inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] px-5 text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] sm:h-12"
              >
                Book a demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={ML.crm}
                className="inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-surface)] px-5 text-[14px] font-semibold text-[var(--marketing-text)] backdrop-blur-md transition-colors hover:bg-[var(--marketing-hover)] sm:h-12"
              >
                See the platform
                <PlayCircle className="h-4 w-4 text-[var(--marketing-text-secondary)]" aria-hidden />
              </Link>
            </div>

            <HeroTrustPoints />
          </div>

          {/* Product visual */}
          <div className="relative min-w-0 pb-4 lg:pb-2">
            <div
              role="img"
              aria-label="SegmiQ salesperson dashboard showing follow-ups, pipeline and WhatsApp sales conversations."
            >
              <ProductHeroVisual />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
