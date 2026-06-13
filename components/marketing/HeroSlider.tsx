"use client";

/**
 * HeroSlider — NVIDIA-style featured-story hero. Auto-advances with a loading-line progress on
 * each tab; click a tab to jump; pauses on hover and when the tab is backgrounded; respects
 * prefers-reduced-motion. No swipe/dots by design.
 *
 * Driven by data (see lib/hero.ts → getHeroSlides), so it reflects featured blog posts.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export type HeroSlide = {
  category: string;   // display label, e.g. "INSIGHT"
  title: string;
  excerpt: string;
  coverImage: string;
  href: string;
};

const DURATION = 6000;

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const reduceRef = useRef(false);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset the timer + the previous fills when the active slide changes.
  useEffect(() => {
    indexRef.current = index;
    startRef.current = performance.now();
    elapsedRef.current = 0;
    fillRefs.current.forEach((f, k) => { if (f && k !== index) f.style.width = "0%"; });
    tabRefs.current[index]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index]);

  // Animation loop + visibility pause.
  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startRef.current = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      if (!pausedRef.current && !reduceRef.current) {
        const t = Math.min((now - startRef.current) / DURATION, 1);
        const f = fillRefs.current[indexRef.current];
        if (f) f.style.width = `${t * 100}%`;
        if (t >= 1) setIndex((i) => (i + 1) % slides.length);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) { pausedRef.current = true; elapsedRef.current = performance.now() - startRef.current; }
      else if (pausedRef.current) { pausedRef.current = false; startRef.current = performance.now() - elapsedRef.current; }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, [slides.length]);

  const pause = () => { if (!pausedRef.current) { pausedRef.current = true; elapsedRef.current = performance.now() - startRef.current; } };
  const resume = () => { if (pausedRef.current) { pausedRef.current = false; startRef.current = performance.now() - elapsedRef.current; } };
  const goto = (i: number) => setIndex(((i % slides.length) + slides.length) % slides.length);

  if (!slides.length) return null;

  return (
    <section
      onMouseEnter={pause}
      onMouseLeave={resume}
      className="relative bg-[#0C0C0C] text-white overflow-hidden"
    >
      {/* slides */}
      <div className="relative lg:min-h-[460px]">
        {slides.map((s, i) => (
          <article
            key={i}
            className={`transition-opacity duration-[550ms] motion-reduce:transition-none ${
              i === index
                ? "relative opacity-100 visible"
                : "absolute inset-0 opacity-0 invisible pointer-events-none"
            } lg:absolute lg:inset-0`}
          >
            <div className="mx-auto max-w-[1100px] px-5 relative grid lg:grid-cols-2 gap-6 lg:gap-8 items-start lg:items-center pt-16 sm:pt-[4.25rem] lg:pt-12 pb-4 lg:pb-2">
              <div className="max-w-[560px] mx-auto lg:mx-0 text-center lg:text-left">
                <div className="text-[12px] tracking-widest font-semibold text-[#D4FF4F]">{s.category}</div>
                <h1 className="mt-2.5 text-[30px] sm:text-[42px] lg:text-[50px] leading-[1.06] font-extrabold tracking-tight">{s.title}</h1>
                <p className="mt-3 text-[15px] sm:text-base text-white/70 max-w-[480px] mx-auto lg:mx-0">{s.excerpt}</p>
                <a href={s.href} className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-[14px] rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">
                  Read the post <ArrowRight className="w-[14px] h-[14px]" />
                </a>

                {/* mobile cover — below CTA, not background */}
                <div className="mt-5 lg:hidden relative aspect-[16/10] rounded-2xl overflow-hidden ring-1 ring-white/10">
                  <Image src={s.coverImage} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
                </div>
              </div>

              {/* desktop contained image */}
              <div className="hidden lg:block relative h-[380px] rounded-2xl overflow-hidden ring-1 ring-white/10">
                <Image src={s.coverImage} alt="" fill priority={i === 0} sizes="(max-width:1024px) 0px, 50vw" className="object-cover" />
                <div className="absolute inset-0 bg-[#0C0C0C]/30" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(12,12,12,.78),rgba(12,12,12,.35) 42%,transparent 62%)" }} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* progress bars — mobile: bars only; desktop: bars + next-post labels */}
      <div className="relative shrink-0">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="flex gap-1.5 lg:gap-5 lg:overflow-x-auto pt-4 pb-3 sm:pb-4 lg:pt-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {slides.map((s, i) => (
              <button
                key={i}
                ref={(el) => { tabRefs.current[i] = el; }}
                onClick={() => goto(i)}
                aria-label={s.title}
                className="relative flex-1 lg:flex-none text-left lg:pt-3.5 lg:min-w-[150px] lg:max-w-[210px]"
              >
                <span className="relative block h-[2px] rounded bg-white/15 overflow-hidden">
                  <span ref={(el) => { fillRefs.current[i] = el; }} className="absolute top-0 left-0 h-full w-0 rounded bg-[#D4FF4F]" />
                </span>
                <span className={`hidden lg:block text-[11px] tracking-[0.08em] font-bold uppercase mt-3.5 ${i === index ? "text-[#D4FF4F]" : "text-white/50"}`}>{s.category}</span>
                <span className={`hidden lg:block text-[13px] leading-[1.3] mt-1 line-clamp-2 ${i === index ? "text-white" : "text-white/55"}`}>{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
