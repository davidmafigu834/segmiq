"use client";

/**
 * Segmiq marketing landing page — Next.js App Router (client component).
 *
 * Design system (MARKETING): dark #0A0A0A sections, lime #D4FF4F accent, Inter,
 * max-w-[1100px] centered. Enterprise polish (ServiceNow-grade): consistent button
 * system, gradient surface cards with hover glow, refined section headers.
 * Shared tokens live in components/marketing/marketingTheme.ts (`m`).
 * Icons: Lucide React only.
 */

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRight, Minus, Plus,
  MessageCircle, Link2, GraduationCap, Target, Check,
  Clock, BarChart3, Zap, Send, Play, Sun, Home, Sprout, Building2,
  BookOpen, Brain, ListChecks, type LucideIcon,
} from "lucide-react";
import { m } from "@/components/marketing/marketingTheme";
import Reveal from "@/components/marketing/Reveal";
import {
  FEATURE_CARD_HREF,
  ML,
  STORY_HREF,
  industrySolutionHref,
} from "@/lib/marketing-links";

/* ---------- placeholder imagery (swap for R2-hosted client photos) ---------- */
const IMG = {
  team: "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?q=70&w=900&h=640&fit=crop&auto=format",
  electrician: "https://images.unsplash.com/photo-1758101755915-462eddc23f57?q=70&w=900&h=640&fit=crop&auto=format",
  solar: "https://images.unsplash.com/photo-1745187946672-2c1d8cf26a2b?q=70&w=900&h=640&fit=crop&auto=format",
  construction: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=900&h=720&fit=crop&auto=format",
};

/* ---------- data ---------- */
const FEATURE_CARDS = [
  { kicker: "PLATFORM", title: "Three portals — agency, manager, and rep — on one system", img: IMG.team },
  { kicker: "WHATSAPP", title: "Every lead confirmed, every rep coached — automatically", img: IMG.electrician },
  { kicker: "INTELLIGENCE", title: "Lead scoring, win patterns, and weekly insights, built in", img: IMG.solar },
];

const STATS = [
  { v: "60s", l: "from capture to a scored, routed lead" },
  { v: "0–100", l: "intent score on every enquiry" },
  { v: "7 days", l: "to fully onboard a new rep" },
  { v: "24/7", l: "WhatsApp capture and follow-up" },
];

const TABS: Record<string, { kicker: string; title: string; Icon: LucideIcon; href: string }[]> = {
  "For owners": [
    { kicker: "GUIDE", title: "Why fast follow-up wins more trade work", Icon: BookOpen, href: ML.why },
    { kicker: "FEATURE", title: "Win analysis: see exactly what closes deals", Icon: Target, href: ML.featuresIntelligence },
    { kicker: "FEATURE", title: "Weekly AI insight, delivered every Monday", Icon: Brain, href: ML.featuresIntelligence },
  ],
  "For managers": [
    { kicker: "FEATURE", title: "Client manager dashboard: today's focus", Icon: Target, href: ML.featuresDashboards },
    { kicker: "FEATURE", title: "Team performance & score distribution", Icon: BarChart3, href: ML.featuresDashboards },
    { kicker: "FEATURE", title: "Stale-lead summary, surfaced for you", Icon: Clock, href: ML.featuresRecovery },
  ],
  "For reps": [
    { kicker: "FEATURE", title: "Priority lead list, scored 0–100", Icon: Zap, href: ML.featuresIntelligence },
    { kicker: "FEATURE", title: "One-tap send: portfolio, pricing, docs", Icon: Send, href: ML.featuresConvert },
    { kicker: "FEATURE", title: "Daily coaching message on WhatsApp", Icon: MessageCircle, href: ML.featuresWhatsapp },
  ],
};

const ACCORDION = [
  { t: "CRM portals", d: "Agency admin, client manager, and salesperson — one login each, scoped to what they need." },
  { t: "WhatsApp automation", d: "Confirmations, magic links, SLA warnings, follow-up reminders, and digests via Meta Cloud API." },
  { t: "Conversational lead capture", d: "A chat-style form on every Segmiq Cloud profile that captures intent as it talks." },
  { t: "Pricing & document library", d: "Reusable pricing packages and a document library you send in one tap." },
  { t: "Intelligence engine", d: "Intent category, urgency, budget confidence, specificity, tags, and a 0–100 score." },
  { t: "Audience segments", d: "Six predefined segments plus custom filters, with Meta-compatible CSV export." },
  { t: "Performance recommendations", d: "Seven rules watching response time, source mix, follow-up compliance, and more." },
  { t: "Dashboards", d: "Tailored dashboards for the agency, the manager, and the rep on the ground." },
];

const STORIES = [
  { img: IMG.solar, title: "A Harare solar installer", body: "routes web and WhatsApp enquiries to the nearest rep and confirms every prospect automatically.", tag: "Solar + Segmiq" },
  { img: IMG.construction, title: "A Lusaka roofing company", body: "uses win-pattern insights to learn which quote sizes and sources actually close.", tag: "Roofing + Segmiq" },
  { img: IMG.electrician, title: "A Johannesburg electrical contractor", body: "runs daily AI coaching for ten field reps and a weekly digest for the owner.", tag: "Electrical + Segmiq" },
];

const INDUSTRIES = [
  { n: "Construction", Icon: Building2, k: "CONSTRUCTION", big: "73%", lab: "faster first response when leads route automatically", body: "Construction firms juggle dozens of site enquiries a week. Segmiq captures each one, scores intent, and assigns it to the right estimator before it goes cold." },
  { n: "Solar", Icon: Sun, k: "SOLAR", big: "2.4×", lab: "more quotes sent when the portfolio is one tap away", body: "Solar installers move on speed. The send panel pushes a full portfolio, pricing package, and past projects to a prospect in seconds." },
  { n: "Roofing", Icon: Home, k: "ROOFING", big: "0–100", lab: "intent score on every single roofing enquiry", body: "Roofing companies see which leads are ready now. Win-pattern insights reveal which quote sizes and sources actually convert." },
  { n: "Electrical", Icon: Zap, k: "ELECTRICAL", big: "Day 7", lab: "a new rep fully coached and producing", body: "Electrical contractors onboard field reps with day 1, 3, and 7 coaching — no manual training drag." },
  { n: "Landscaping", Icon: Sprout, k: "LANDSCAPING", big: "Weekly", lab: "AI insight surfacing what to fix next", body: "Landscaping businesses get a weekly digest of what is working, what is stalling, and which leads to recover." },
  { n: "Trades", Icon: ListChecks, k: "TRADES", big: "1 system", lab: "capture, score, coach, and close in one place", body: "Any trade business runs its whole revenue motion on Segmiq — from first enquiry to recorded win." },
  { n: "Real estate dev", Icon: Target, k: "REAL ESTATE", big: "6", lab: "ready-made audience segments for retargeting", body: "Developers rebuild interest with predefined segments and Meta-ready CSV exports for ad campaigns." },
];

const PLANS = [
  { name: "STARTER", price: "$99", sub: "Up to 5 salespeople", feats: ["All three portals", "WhatsApp lead capture", "Lead timeline & handover"], dark: false },
  { name: "GROWTH", price: "$199", sub: "Up to 15 salespeople, AI features", feats: ["Everything in Starter", "Lead scoring & daily coaching", "Win analysis & insights"], dark: true },
  { name: "SCALE", price: "$349", sub: "Unlimited salespeople", feats: ["Everything in Growth", "Full intelligence engine", "Audience segments & exports"], dark: false },
];

const MARKETS = ["Harare", "Lusaka", "Johannesburg", "Nairobi", "Cape Town", "Bulawayo"];

/* ---------- small building blocks ---------- */
function SectionHeading({
  eyebrow, title, sub, center = true, className = "",
}: { eyebrow: string; title: ReactNode; sub?: ReactNode; center?: boolean; className?: string }) {
  return (
    <div className={`${center ? "mx-auto max-w-[640px] text-center" : "max-w-[620px]"} ${className}`}>
      <span className={m.eyebrowChip}>{eyebrow}</span>
      <h2 className="mt-4 text-[30px] sm:text-[40px] leading-[1.08] font-extrabold tracking-tight text-white">
        {title}
      </h2>
      {sub && <p className="mt-4 text-[15px] sm:text-base text-white/60">{sub}</p>}
    </div>
  );
}

/* ---------- component ---------- */
export default function SegmiqLandingPage() {
  const [tab, setTab] = useState("For owners");
  const [openRow, setOpenRow] = useState(0);
  const [industry, setIndustry] = useState(0);

  const ind = INDUSTRIES[industry];

  return (
    <div className={`relative antialiased font-sans ${m.page}`}>
      {/* ===== STATS BAND ===== */}
      <section className="border-b border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-[1100px] px-5 py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l} className="text-center md:text-left">
                <div className="text-[28px] font-extrabold tracking-tight text-[#D4FF4F]">{s.v}</div>
                <div className="mt-1 text-[13px] leading-snug text-white/55">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THREE FEATURE PHOTO CARDS ===== */}
      <section className="pt-16 pb-6 sm:pt-20">
        <div className="mx-auto max-w-[1100px] px-5">
          <SectionHeading
            eyebrow="What Segmiq does"
            title="Everything between a lead and a contract"
            sub="Segmiq captures the enquiry, follows it up, and helps your team close — one system built for how trade businesses in Africa actually sell."
            className="mb-12"
          />
          <div className="grid gap-5 md:grid-cols-3">
            {FEATURE_CARDS.map(({ kicker, title, img }, i) => (
              <Reveal key={kicker} delay={i * 90}>
              <a
                href={FEATURE_CARD_HREF[kicker] ?? ML.features}
                className={`mk-shine group relative block h-[320px] overflow-hidden rounded-2xl border border-white/10 text-white transition-all duration-300 hover:-translate-y-1 hover:border-[#D4FF4F]/30 hover:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.8)]`}
              >
                <Image src={img} alt={kicker} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span className={m.eyebrow}>{kicker}</span>
                  <div className="mt-2 text-[18px] font-semibold leading-snug">{title}</div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#D4FF4F] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TABBED ROW ===== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className={m.glass}>
            <div className={`mb-6 flex gap-2 ${""}`}>
              {Object.keys(TABS).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === t ? "bg-[#D4FF4F] text-black" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {TABS[tab].map(({ kicker, title, Icon, href }) => (
                <a
                  key={title}
                  href={href}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4FF4F]/30 hover:bg-white/[0.05]"
                >
                  <div>
                    <div className={`text-[11px] font-semibold tracking-widest ${m.faint}`}>{kicker}</div>
                    <div className="mt-1 text-sm font-medium leading-snug">{title}</div>
                  </div>
                  <span className={`h-11 w-11 shrink-0 ${m.iconTile} transition-colors group-hover:border-[#D4FF4F]/40`}>
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS ACCORDION ===== */}
      <section id="products" className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="grid lg:grid-cols-2 lg:gap-12 lg:items-start">
            <div className="lg:sticky lg:top-24 lg:self-start lg:z-10">
              <span className={m.eyebrowChip}>The platform</span>
              <h2 className="mt-4 text-[30px] font-extrabold leading-tight">
                Access the full <span className={m.highlight}>revenue stack</span>, plus the intelligence layer
              </h2>
              <p className={`mt-4 max-w-[420px] text-[15px] ${m.muted}`}>
                Capture leads, route them in seconds, send your portfolio in one tap, and let the platform tell you who to call next.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={ML.login} className={m.btnPrimary}>Open the platform <ArrowRight className="h-4 w-4" /></a>
                <a href={ML.features} className={m.btnSecondary}>See all features</a>
              </div>
            </div>
            <div className={`mt-10 lg:mt-0`}>
              {ACCORDION.map((a, i) => {
                const open = openRow === i;
                return (
                  <div
                    key={a.t}
                    className={`mb-2.5 rounded-xl border transition-colors ${open ? "border-[#D4FF4F]/30 bg-white/[0.04]" : "border-white/10 bg-white/[0.015] hover:border-white/20"}`}
                  >
                    <button onClick={() => setOpenRow(open ? -1 : i)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-[15px] font-medium">
                      <span>{a.t}</span>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${open ? "border-[#D4FF4F]/40 text-[#D4FF4F]" : "border-white/15 text-white/50"}`}>
                        {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                    <div className={`overflow-hidden transition-[max-height] duration-300 ${open ? "max-h-40" : "max-h-0"}`}>
                      <p className={`px-4 pb-4 pr-10 text-sm ${m.muted}`}>{a.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== DARK SHOWCASE ===== */}
      <section className={`py-20 ${m.sectionBand} bg-gradient-to-b from-white/[0.02] to-transparent text-white`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div>
              <span className={m.eyebrowChip}>Intelligence layer</span>
              <h2 className="mt-4 text-[28px] sm:text-[34px] font-extrabold leading-tight">
                Scale your sales engine with the <span className="text-[#D4FF4F]">Segmiq intelligence layer</span>
              </h2>
            </div>
            <div>
              <p className="text-[15px] text-white/70">
                <span className="font-medium text-white">The intelligence engine</span> processes every lead for intent, urgency, and budget confidence — then scores it 0–100 and tells your reps exactly where to spend their day.
              </p>
              <a href={ML.login} className={`mt-5 ${m.btnPrimary}`}>Try it in the console <ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <div className="rounded-xl bg-[#D4FF4F] p-4 text-black shadow-[0_18px_40px_-20px_rgba(212,255,79,0.6)]">
                <div className="text-[11px] font-semibold tracking-widest opacity-70">FROM CAPTURE TO CLOSE</div>
                <div className="font-semibold">Score, route, and confirm a lead in under 60 seconds</div>
              </div>
              {[
                { Icon: MessageCircle, k: "DAILY COACHING", d: "A WhatsApp coaching message for every rep, every morning" },
                { Icon: Clock, k: "STALE LEAD RECOVERY", d: "Detect cold leads and trigger the recovery sequence" },
                { Icon: BarChart3, k: "WEEKLY DIGEST", d: "A manager summary in the inbox every Monday" },
              ].map(({ Icon, k, d }) => (
                <div key={k} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20">
                  <span className={`h-9 w-9 shrink-0 ${m.iconTile}`}><Icon className="h-[18px] w-[18px]" /></span>
                  <div>
                    <div className="text-[11px] font-semibold tracking-widest text-[#D4FF4F]">{k}</div>
                    <div className="text-white/80">{d}</div>
                  </div>
                </div>
              ))}
              <a href={ML.featuresIntelligence} className={`pt-1 ${m.btnLink}`}>View more <ArrowRight className="h-4 w-4" /></a>
            </div>

            {/* mock dashboard */}
            <div className="mk-border-glow rounded-2xl border border-white/10 bg-[#0A0A14] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[ ["92", "intent score", "text-white"], ["18m", "avg response", "text-[#D4FF4F]"], ["7", "hot leads", "text-white"] ].map(([v, l, c]) => (
                  <div key={l} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className={`text-2xl font-extrabold ${c}`}>{v}</div>
                    <div className="text-[11px] text-white/50">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                {[ ["Solar — Borrowdale", 88], ["Roofing — Avondale", 71], ["Electrical — Mt Pleasant", 64] ].map(([label, pct]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-[13px]"><span className="text-white/80">{label}</span><span className="font-semibold text-[#D4FF4F]">{pct}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#9be000] to-[#D4FF4F]" style={{ width: `${pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { Icon: Link2, t: "Share your portfolio with one tap", cta: "Open send panel", href: ML.featuresConvert },
              { Icon: GraduationCap, t: "Onboard a new rep in 7 days", cta: "Start onboarding", href: ML.featuresWhatsapp },
              { Icon: Target, t: "Build a retargeting segment in minutes", cta: "View segments", href: ML.featuresSegments },
            ].map(({ Icon, t, cta, href }) => (
              <div key={t} className={`${m.surface} p-5`}>
                <span className={`mb-3 h-10 w-10 ${m.iconTile}`}><Icon className="h-5 w-5" /></span>
                <div className="font-medium">{t}</div>
                <a href={href} className={`mt-2 ${m.btnLink}`}>{cta} <ArrowRight className="h-[15px] w-[15px]" /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CUSTOMER STORIES ===== */}
      <section className="py-20">
        <div className="mx-auto max-w-[1100px] px-5">
          <SectionHeading
            eyebrow="Outcomes"
            title={<><span className={m.highlight}>Faster closing</span> happens on Segmiq</>}
            sub="Illustrative sector examples — real client stories land as onboarding completes."
            className="mb-12"
          />
          <div className="grid gap-5 md:grid-cols-3">
            {STORIES.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className={`mk-shine ${m.surface} overflow-hidden`}>
                  <div className="p-6">
                    <div className="font-semibold">{s.title}</div>
                    <p className={`mt-1.5 text-sm ${m.muted}`}>{s.body}</p>
                    <a href={STORY_HREF[s.tag] ?? ML.contact} className={`mt-3 ${m.btnLink}`}>Watch demo <Play className="h-3.5 w-3.5 fill-current" /></a>
                  </div>
                  <div className="relative h-44 overflow-hidden">
                    <Image src={s.img} alt={s.tag} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-black transition-transform duration-300 group-hover:scale-110"><Play className="h-5 w-5 fill-current" /></span>
                    </div>
                    <span className="absolute bottom-3 left-4 text-[13px] font-medium text-white">{s.tag}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INDUSTRY SPLIT ===== */}
      <section id="solutions" className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className={m.eyebrowChip}>Solutions</span>
              <h2 className="mt-4 max-w-[460px] text-[30px] font-extrabold leading-tight">
                Solve your pipeline problem with <span className={m.highlight}>trade solutions</span>
              </h2>
            </div>
            <div className={`max-w-[360px] text-[15px] ${m.muted}`}>
              From missed enquiries to slow follow-up, Segmiq is built around how service businesses actually win work.{" "}
              <a href={ML.contact} className={m.inlineLink}>Request a demo</a>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2.5">
              {INDUSTRIES.map((x, i) => {
                const on = industry === i;
                const Icon = x.Icon;
                return (
                  <button
                    key={x.n}
                    onClick={() => setIndustry(i)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors ${
                      on ? "bg-[#D4FF4F] font-semibold text-black" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 opacity-80" /> {x.n}
                  </button>
                );
              })}
              <a href={ML.homeSolutions} className={`mt-1 block px-3.5 py-2 text-sm underline ${m.faint} hover:text-white`}>See all industries</a>
            </div>
            <div className={`grid overflow-hidden rounded-2xl border ${m.border} md:grid-cols-2`}>
              <div className="relative min-h-[300px]">
                <Image src={IMG.construction} alt="Trade work on site" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
                <div className="absolute bottom-5 left-5 rounded-2xl border border-white/10 bg-black/50 px-5 py-4 backdrop-blur">
                  <div className="text-3xl font-extrabold text-[#D4FF4F]">{ind.big}</div>
                  <div className="max-w-[180px] text-[13px] text-white/85">{ind.lab}</div>
                </div>
              </div>
              <div className="bg-white/[0.03] p-7">
                <span className={m.eyebrow}>{ind.k}</span>
                <p className={`mt-3 text-[15px] ${m.muted}`}>{ind.body}</p>
                <a href={industrySolutionHref(ind.n)} className={`mt-5 ${m.btnPrimary}`}>
                  Explore {ind.n.toLowerCase()} <ArrowRight className="h-[15px] w-[15px]" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MARKETS STRIP ===== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <p className={`mb-6 text-center text-[12px] font-semibold uppercase tracking-[0.14em] ${m.faint}`}>Live across Sub-Saharan markets</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {MARKETS.map((city) => (
              <span key={city} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[14px] font-semibold text-white/70">
                <Building2 className="h-4 w-4 text-[#D4FF4F]" /> {city}
              </span>
            ))}
          </div>
          <div className="mt-7 text-center">
            <a href={ML.contact} className={m.btnPrimary}>See more markets <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className={`py-20 ${m.sectionBand} bg-gradient-to-b from-white/[0.02] to-transparent`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <SectionHeading
            eyebrow="Pricing"
            title="Pricing that scales with your team"
            sub="Per client company, billed monthly. Cancel anytime."
            className="mb-12"
          />
          <div className="grid gap-5 md:grid-cols-3 md:items-start">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 90} className={p.dark ? "md:-mt-3" : ""}>
              <div
                className={`relative h-full rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 ${
                  p.dark
                    ? "mk-border-glow border border-[#D4FF4F]/40 bg-gradient-to-b from-[#1a1f0a] to-[#0c0c0c] shadow-[0_30px_70px_-30px_rgba(212,255,79,0.35)] md:pb-9"
                    : "border border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-[13px] font-semibold tracking-widest ${p.dark ? "text-[#D4FF4F]" : m.pricingLabel}`}>{p.name}</div>
                  {p.dark && <span className="rounded-full bg-[#D4FF4F] px-2.5 py-0.5 text-[11px] font-semibold text-black">Most popular</span>}
                </div>
                <div className="mt-3 text-[44px] font-extrabold leading-none">{p.price}<span className={`text-[15px] font-medium ${p.dark ? "text-white/60" : m.pricingSub}`}>/mo</span></div>
                <div className={`mt-1.5 text-sm ${p.dark ? "text-white/60" : m.pricingSub}`}>{p.sub}</div>
                <div className={`my-5 ${m.divider}`} />
                <ul className="space-y-2.5 text-sm">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D4FF4F]/15 text-[#D4FF4F]"><Check className="h-3.5 w-3.5" /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={ML.contact} className={`mt-7 w-full ${p.dark ? m.btnPrimary : m.btnSecondary}`}>
                  Choose {p.name.charAt(0) + p.name.slice(1).toLowerCase()}
                </a>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#D4FF4F] to-[#a9e000] p-6 text-center sm:p-12 md:p-16">
            <div className="mk-glow-pulse pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/30 blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-[720px] text-[28px] font-extrabold leading-[1.08] text-black sm:text-[36px] md:text-[46px]">
                Let&apos;s start closing more work, today
              </h2>
              <p className="mx-auto mt-4 max-w-[540px] px-1 text-[15px] text-black/70">
                Open the platform or talk to sales — we&apos;ll set up a portal and show you Segmiq on a sample of your real leads.
              </p>
              <div className="mx-auto mt-7 flex max-w-[320px] flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
                <a href={ML.login} className={m.btnOnLight}>Open the platform <ArrowRight className="h-4 w-4" /></a>
                <a href={ML.contact} className="inline-flex items-center justify-center rounded-full border border-black/25 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-black/5">Contact sales</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
