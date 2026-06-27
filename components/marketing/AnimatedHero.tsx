"use client";

/**
 * AnimatedHero — replaces the blog-driven HeroSlider on the marketing home page.
 *
 * A clean, single-message hero (headline + subcopy + CTAs + trust strip) sitting on top of
 * the ServiceNowBackground WebGL scene. No featured-blog carousel.
 */

import { ArrowRight, Sparkles } from "lucide-react";
import { m } from "@/components/marketing/marketingTheme";
import { ML } from "@/lib/marketing-links";

const TRUST = ["Construction", "Solar", "Roofing", "Electrical", "Landscaping"];

export default function AnimatedHero() {
  return (
    <section className="relative overflow-hidden text-white">
      {/* floating ambient glow blobs (the live WebGL backdrop is page-global) */}
      <div className="mk-glow-pulse pointer-events-none absolute -left-24 top-10 -z-10 h-56 w-56 rounded-full bg-[#D4FF4F]/20 blur-[90px] sm:h-72 sm:w-72 sm:blur-[100px]" />
      <div className="mk-float pointer-events-none absolute -right-16 bottom-6 -z-10 h-64 w-64 rounded-full bg-[#3dd68c]/10 blur-[100px] sm:h-80 sm:w-80 sm:blur-[110px]" />

      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <div className="flex min-h-[80vh] flex-col items-center justify-center py-20 text-center sm:min-h-[78vh] sm:py-28">
          <span className="inline-flex max-w-[92vw] flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur sm:px-3.5 sm:text-[12px]">
            <span className="mk-pulse-dot relative grid h-3.5 w-3.5 shrink-0 place-items-center sm:h-4 sm:w-4">
              <span className="h-2 w-2 rounded-full bg-[#D4FF4F]" />
            </span>
            <span className="sm:hidden">Revenue OS for trade teams</span>
            <span className="hidden sm:inline">The revenue operating system for trade businesses</span>
            <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-[#D4FF4F] sm:inline" />
          </span>

          <h1 className="mt-6 max-w-[820px] text-balance text-[32px] font-extrabold leading-[1.08] tracking-tight sm:text-[48px] sm:leading-[1.05] lg:text-[64px]">
            Capture, score, and close
            <br className="hidden sm:block" /> every lead with{" "}
            <span className="mk-text-shimmer">Segmiq</span>
          </h1>

          <p className="mt-4 max-w-[560px] text-balance text-[15px] leading-relaxed text-white/70 sm:mt-5 sm:text-[17px]">
            One system for construction, solar, roofing, electrical, and landscaping teams across
            Africa — from first enquiry to recorded win.
          </p>

          <div className="mt-7 flex w-full max-w-[360px] flex-col items-stretch gap-3 sm:mt-8 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
            <a href={ML.login} className={`${m.btnPrimary} px-6 py-3 text-base`}>
              Open the platform <ArrowRight className="h-[16px] w-[16px]" />
            </a>
            <a href={ML.contact} className={`${m.btnSecondary} px-6 py-3 text-base`}>
              Talk to sales
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-medium text-white/45 sm:mt-12 sm:gap-x-6 sm:text-[13px]">
            <span className="w-full text-white/35 sm:w-auto">Built for</span>
            {TRUST.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
