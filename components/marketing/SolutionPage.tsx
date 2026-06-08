/**
 * SolutionPage — reusable template for industry solution pages.
 * Header/footer come from app/(marketing)/layout.tsx. Server component.
 *
 * Each route under app/(marketing)/solutions/<industry>/page.tsx passes a SolutionData
 * object. Only the data changes per industry; this layout stays identical.
 *
 * Images are placeholder Unsplash URLs — replace with R2-hosted client photos.
 */

import Image from "next/image";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type Step = { Icon: LucideIcon; t: string; d: string };

export type SolutionData = {
  kicker: string;
  h1: string;
  sub: string;
  heroImg: string;
  heroTag1: string;
  heroTag2: string;
  industryLower: string;
  problemH2: string;
  problemP: string;
  steps: Step[];
  stats: { n: string; t: string }[];
  cloudImg: string;
  cloudH2: string;
  cloudP: string;
  ctaH2: string;
  ctaP: string;
  others: { label: string; href: string }[];
};

export default function SolutionPage(d: SolutionData) {
  return (
    <>
      {/* HERO */}
      <section className="pt-16 pb-12">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">{d.kicker}</div>
            <h1 className="mt-3 text-[38px] sm:text-[48px] leading-[1.06] font-extrabold tracking-tight">{d.h1}</h1>
            <p className="mt-5 text-base text-[#5b5b5b] max-w-[520px]">{d.sub}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#" className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Book a demo</a>
              <a href="#" className="px-6 py-3 rounded-full border border-black/[0.08] font-semibold hover:border-black/30">See pricing</a>
            </div>
          </div>
          <div className="group relative h-[360px] rounded-2xl ring-1 ring-black/[0.08] overflow-hidden">
            <Image src={d.heroImg} alt={d.kicker} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/[0.86]" />
            <div className="absolute bottom-5 left-5 text-white">
              <div className="text-xs tracking-widest font-semibold text-[#D4FF4F]">{d.heroTag1}</div>
              <div className="text-[18px] font-semibold leading-snug max-w-[260px]">{d.heroTag2}</div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-12 bg-[#F8F7F4]">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="max-w-[680px]">
            <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">THE PROBLEM</div>
            <h2 className="text-[28px] font-extrabold leading-tight mt-2">{d.problemH2}</h2>
            <p className="mt-3 text-[15px] text-[#5b5b5b]">{d.problemP}</p>
          </div>
        </div>
      </section>

      {/* HOW SEGMIQ WORKS */}
      <section className="py-14">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">How Segmiq works for {d.industryLower}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-9">
            {d.steps.map(({ Icon, t, d: desc }) => (
              <div key={t} className="rounded-2xl border border-black/[0.08] p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4"><Icon className="w-[22px] h-[22px]" /></span>
                <div className="font-semibold">{t}</div>
                <p className="text-sm text-[#5b5b5b] mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STAT BAND */}
      <section className="py-12 bg-[#0C0C0C] text-white">
        <div className="mx-auto max-w-[1100px] px-5 grid sm:grid-cols-3 gap-6 text-center">
          {d.stats.map((s) => (
            <div key={s.n}>
              <div className="text-[44px] font-extrabold leading-none text-[#D4FF4F]">{s.n}</div>
              <p className="mt-2 text-sm text-white/70">{s.t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CLOUD TIE-IN */}
      <section className="py-14">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div className="relative h-[320px] rounded-2xl ring-1 ring-black/[0.08] overflow-hidden order-2 lg:order-1">
            <Image src={d.cloudImg} alt="Finished work" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <div className="order-1 lg:order-2">
            <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">WITH SEGMIQ CLOUD</div>
            <h2 className="text-[28px] font-extrabold leading-tight mt-2">{d.cloudH2}</h2>
            <p className="mt-3 text-[15px] text-[#5b5b5b]">{d.cloudP}</p>
            <a href="https://cloud.segmiq.com" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-[#0C0C0C] text-white font-semibold hover:opacity-90">Explore Segmiq Cloud <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </section>

      {/* OTHER INDUSTRIES */}
      <section className="py-10">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-[#5b5b5b]">
            <span className="text-[#8a8a8a] mr-1">Also for:</span>
            {d.others.map((o) => (
              <a key={o.label} href={o.href} className="rounded-full border border-black/[0.08] px-4 py-1.5 hover:border-black/30 hover:text-black">{o.label}</a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-10 md:p-14 text-center">
            <h2 className="text-[32px] md:text-[40px] font-extrabold leading-[1.08] text-black max-w-[680px] mx-auto">{d.ctaH2}</h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">{d.ctaP}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#" className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">Book a demo</a>
              <a href="#" className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5">See pricing</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
