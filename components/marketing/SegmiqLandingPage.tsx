"use client";

/**
 * Segmiq marketing landing page — Next.js App Router (client component).
 *
 * Design system (MARKETING): dark #0C0C0C sections, lime #D4FF4F accent,
 * Inter, max-w-[1100px] centered.
 * Icons: Lucide React only. No inline styles for layout. Tailwind utilities only.
 *
 * Suggested placement: app/(marketing)/page.tsx  (or app/page.tsx)
 *
 * IMAGES: the Unsplash URLs below are PLACEHOLDERS. For production, replace with
 * real client photos served from Cloudflare R2. If you keep remote URLs, add the
 * host to next.config images.remotePatterns (see Windsurf prompt).
 *
 * FONT: load Inter once in app/layout.tsx via next/font instead of a <link>:
 *   import { Inter } from "next/font/google";
 *   const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
 *   <body className={inter.className}> ...
 */

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight, ChevronLeft, ChevronRight, ChevronDown,
  MessageCircle, Link2, GraduationCap, Target, Check,
  Clock, BarChart3, Zap, Send, Play, Sun, Home, Sprout, Building2,
  BookOpen, Brain, ListChecks, type LucideIcon,
} from "lucide-react";
import { m } from "@/components/marketing/marketingTheme";
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

const tabActive = "text-white";
const tabIdle = "text-white/50";
const industryList = `rounded-xl border ${m.border} p-2 text-sm`;
const industryIdle = "text-white/55 hover:bg-white/[0.05]";
const industryPanel = "p-6 bg-white/[0.04]";
const storyCard = `group rounded-xl border ${m.border} overflow-hidden bg-white/[0.02]`;

/* ---------- component ---------- */
export default function SegmiqLandingPage() {
  const [tab, setTab] = useState("For owners");
  const [openRow, setOpenRow] = useState(0);
  const [industry, setIndustry] = useState(0);

  const ind = INDUSTRIES[industry];

  return (
    <div className={`relative antialiased font-sans ${m.page}`}>
      {/* ===== THREE FEATURE PHOTO CARDS ===== */}
      <section className="pt-8 sm:pt-10 pb-6">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="grid md:grid-cols-3 gap-4">
            {FEATURE_CARDS.map(({ kicker, title, img }) => (
              <a key={kicker} href={FEATURE_CARD_HREF[kicker] ?? ML.features} className={`group relative block h-[300px] overflow-hidden rounded-2xl ring-1 ${m.ring} text-white transition-transform duration-300 hover:-translate-y-1`}>
                <Image src={img} alt={kicker} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/90" />
                <div className="absolute bottom-0 left-0 p-5">
                  <div className="text-[11px] tracking-widest text-[#D4FF4F] font-semibold">{kicker}</div>
                  <div className="mt-1 text-[17px] font-semibold leading-snug">{title}</div>
                </div>
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button className={m.iconBtn}><ChevronLeft className="w-[18px] h-[18px]" /></button>
            <button className={m.iconBtn}><ChevronRight className="w-[18px] h-[18px]" /></button>
          </div>
        </div>
      </section>

      {/* ===== TABBED ROW ===== */}
      <section className="py-8">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className={m.panel}>
            <div className={`flex gap-6 text-sm border-b mb-5 ${m.border}`}>
              {Object.keys(TABS).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative pb-2.5 ${tab === t ? `${tabActive} after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-full after:bg-[#D4FF4F]` : tabIdle}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {TABS[tab].map(({ kicker, title, Icon, href }) => (
                <a key={title} href={href} className={`flex items-center justify-between gap-3 transition-transform duration-300 hover:-translate-y-1 ${m.card}`}>
                  <div>
                    <div className={`text-[11px] tracking-widest font-semibold ${m.faint}`}>{kicker}</div>
                    <div className="mt-1 text-sm font-medium leading-snug">{title}</div>
                  </div>
                  <span className={`shrink-0 grid place-items-center w-11 h-11 ${m.cardIcon}`}><Icon className="w-[22px] h-[22px]" /></span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS ACCORDION ===== */}
      <section id="products" className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="grid lg:grid-cols-2 lg:gap-10 lg:items-start">
            <div className="lg:sticky lg:top-24 lg:self-start lg:z-10">
              <h2 className="text-[30px] font-extrabold leading-tight">
                Access the full <span className={m.highlight}>revenue stack</span>, plus the intelligence layer
              </h2>
              <p className={`mt-4 text-[15px] max-w-[420px] ${m.muted}`}>
                Capture leads, route them in seconds, send your portfolio in one tap, and let the platform tell you who to call next.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={ML.login} className="px-5 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Open the platform</a>
                <a href={ML.features} className={`px-5 py-2.5 ${m.ghostBtn}`}>See all features</a>
              </div>
            </div>
            <div className={`mt-10 lg:mt-0 border-t ${m.border} lg:relative lg:border-t-0`}>
              {ACCORDION.map((a, i) => {
                const open = openRow === i;
                return (
                  <div key={a.t} className={`border-b ${m.border}`}>
                    <button onClick={() => setOpenRow(open ? -1 : i)} className="w-full flex items-center justify-between py-4 text-[15px] font-medium text-left">
                      <span>{a.t}</span>
                      <ChevronDown className={`w-[18px] h-[18px] ${m.faint} transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                    </button>
                    <div className={`overflow-hidden transition-[max-height] duration-300 ${open ? "max-h-40" : "max-h-0"}`}>
                      <p className={`pb-4 pr-8 text-sm ${m.muted}`}>{a.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== DARK SHOWCASE ===== */}
      <section className={`text-white py-16 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <h2 className="text-[28px] sm:text-[32px] font-extrabold leading-tight">
              Scale your sales engine with the <span className="text-[#D4FF4F]">Segmiq intelligence layer</span>
            </h2>
            <div>
              <p className="text-[15px] text-white/70">
                <span className="text-white font-medium">The intelligence engine</span> processes every lead for intent, urgency, and budget confidence — then scores it 0–100 and tells your reps exactly where to spend their day.
              </p>
              <a href={ML.login} className="inline-block mt-5 px-5 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-white/90">Try it in the console</a>
            </div>
          </div>

          <div className="mt-10 grid lg:grid-cols-[1fr_1.2fr] gap-6">
            <div className="space-y-3">
              <div className="rounded-xl bg-[#D4FF4F] text-black p-4">
                <div className="text-[11px] tracking-widest font-semibold opacity-70">FROM CAPTURE TO CLOSE</div>
                <div className="font-semibold">Score, route, and confirm a lead in under 60 seconds</div>
              </div>
              {[
                { Icon: MessageCircle, k: "DAILY COACHING", d: "A WhatsApp coaching message for every rep, every morning" },
                { Icon: Clock, k: "STALE LEAD RECOVERY", d: "Detect cold leads and trigger the recovery sequence" },
                { Icon: BarChart3, k: "WEEKLY DIGEST", d: "A manager summary in the inbox every Monday" },
              ].map(({ Icon, k, d }) => (
                <div key={k} className="rounded-xl bg-[#181818] p-4 flex items-start gap-3">
                  <Icon className="w-[18px] h-[18px] mt-0.5 text-[#D4FF4F]" />
                  <div>
                    <div className="text-[11px] tracking-widest text-[#D4FF4F] font-semibold">{k}</div>
                    <div className="text-white/80">{d}</div>
                  </div>
                </div>
              ))}
              <a href={ML.featuresIntelligence} className="inline-flex items-center gap-1 text-[#D4FF4F] font-semibold pt-1">View more <ArrowRight className="w-4 h-4" /></a>
            </div>

            {/* mock dashboard */}
            <div className="rounded-xl bg-[#0A0A14] border border-white/10 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff4444]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f5a623]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#3dd68c]" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[ ["92", "intent score", ""], ["18m", "avg response", "text-[#D4FF4F]"], ["7", "hot leads", ""] ].map(([v, l, c]) => (
                  <div key={l} className="rounded-lg bg-[#181818] p-3">
                    <div className={`text-2xl font-extrabold ${c}`}>{v}</div>
                    <div className="text-[11px] text-white/50">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-[#181818] p-3 space-y-2">
                {[ ["Solar — Borrowdale", 88], ["Roofing — Avondale", 71], ["Electrical — Mt Pleasant", 64] ].map(([label, pct]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-[13px]"><span className="text-white/80">{label}</span><span className="text-[#D4FF4F] font-semibold">{pct}</span></div>
                    <div className="h-1.5 rounded bg-white/10"><div className="h-full rounded bg-[#D4FF4F]" style={{ width: `${pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              { Icon: Link2, t: "Share your portfolio with one tap", cta: "Open send panel", href: ML.featuresConvert },
              { Icon: GraduationCap, t: "Onboard a new rep in 7 days", cta: "Start onboarding", href: ML.featuresWhatsapp },
              { Icon: Target, t: "Build a retargeting segment in minutes", cta: "View segments", href: ML.featuresSegments },
            ].map(({ Icon, t, cta, href }) => (
              <div key={t} className="rounded-xl bg-[#181818] p-5">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/5 text-[#D4FF4F] mb-3"><Icon className="w-5 h-5" /></span>
                <div className="font-medium">{t}</div>
                <a href={href} className="text-[#D4FF4F] text-sm font-semibold mt-2 inline-flex items-center gap-1">{cta} <ArrowRight className="w-[15px] h-[15px]" /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CUSTOMER STORIES ===== */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-center text-[30px] font-extrabold">
            <span className={m.highlight}>Faster closing</span> happens on Segmiq
          </h2>
          <p className={`text-center text-[13px] mt-2 ${m.faint}`}>Illustrative sector examples — real client stories land as onboarding completes.</p>
          <div className="grid md:grid-cols-3 gap-5 mt-9">
            {STORIES.map((s) => (
              <div key={s.title} className={`${storyCard} transition-transform duration-300 hover:-translate-y-1`}>
                <div className="p-5">
                  <div className="font-semibold">{s.title}</div>
                  <p className={`text-sm mt-1 ${m.muted}`}>{s.body}</p>
                  <a href={STORY_HREF[s.tag] ?? ML.contact} className="text-[#D4FF4F] text-sm font-semibold mt-3 inline-flex items-center gap-1">Watch demo <Play className="w-3.5 h-3.5 fill-current" /></a>
                </div>
                <div className="relative h-44 overflow-hidden">
                  <Image src={s.img} alt={s.tag} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/90" />
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="grid place-items-center w-12 h-12 rounded-full bg-white/90 text-black"><Play className="w-5 h-5 fill-current" /></span>
                  </div>
                  <span className="absolute bottom-3 left-4 text-white text-[13px] font-medium">{s.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INDUSTRY SPLIT ===== */}
      <section id="solutions" className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <h2 className="text-[30px] font-extrabold leading-tight max-w-[460px]">
              Solve your pipeline problem with <span className={m.highlight}>trade solutions</span>
            </h2>
            <div className={`text-[15px] max-w-[360px] ${m.muted}`}>
              From missed enquiries to slow follow-up, Segmiq is built around how service businesses actually win work.{" "}
              <a href={ML.contact} className={m.inlineLink}>Request a demo</a>
            </div>
          </div>
          <div className="grid lg:grid-cols-[260px_1fr] gap-5">
            <div className={industryList}>
              {INDUSTRIES.map((x, i) => {
                const on = industry === i;
                const Icon = x.Icon;
                return (
                  <button
                    key={x.n}
                    onClick={() => setIndustry(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${on ? "bg-[#D4FF4F] font-semibold text-black" : industryIdle}`}
                  >
                    <Icon className="w-4 h-4 opacity-80" /> {x.n}
                  </button>
                );
              })}
              <a href={ML.homeSolutions} className={`block px-3 py-2 mt-1 underline ${m.faint}`}>See all industries</a>
            </div>
            <div className={`rounded-xl border overflow-hidden grid md:grid-cols-2 ${m.border}`}>
              <div className="relative min-h-[280px]">
                <Image src={IMG.construction} alt="Trade work on site" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/90" />
                <div className="absolute bottom-4 left-4 rounded-xl bg-black/45 backdrop-blur px-5 py-4 text-white">
                  <div className="text-3xl font-extrabold text-[#D4FF4F]">{ind.big}</div>
                  <div className="text-[13px] text-white/85 max-w-[180px]">{ind.lab}</div>
                </div>
              </div>
              <div className={industryPanel}>
                <div className={`text-[11px] tracking-widest font-semibold ${m.faint}`}>{ind.k}</div>
                <p className={`mt-2 text-[15px] ${m.muted}`}>{ind.body}</p>
                <a href={industrySolutionHref(ind.n)} className="inline-flex items-center gap-1 mt-4 bg-[#0C0C0C] text-[#D4FF4F] font-semibold px-3 py-1.5 rounded-full text-sm">
                  Explore {ind.n.toLowerCase()} <ArrowRight className="w-[15px] h-[15px]" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MARKETS STRIP ===== */}
      <section className="py-10">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className={`flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[15px] font-semibold ${m.muted}`}>
            {MARKETS.map((city) => (
              <span key={city} className="inline-flex items-center gap-2"><Building2 className="w-4 h-4" /> {city}</span>
            ))}
          </div>
          <div className="text-center mt-6">
            <a href={ML.contact} className="px-5 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold text-sm hover:bg-[#c8f040]">See more markets</a>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className={`py-14 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-center text-[30px] font-extrabold">Pricing that scales with your team</h2>
          <p className={`text-center text-[15px] mt-2 ${m.muted}`}>Per client company, billed monthly. Cancel anytime.</p>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`transition-transform duration-300 hover:-translate-y-1 ${
                  p.dark
                    ? "rounded-2xl p-6 bg-[#0C0C0C] text-white ring-2 ring-[#D4FF4F]"
                    : m.pricingCard
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-[13px] font-semibold tracking-wide ${p.dark ? "text-[#D4FF4F]" : m.pricingLabel}`}>{p.name}</div>
                  {p.dark && <span className="text-[11px] bg-[#D4FF4F] text-black px-2 py-0.5 rounded-full font-semibold">Popular</span>}
                </div>
                <div className="mt-2 text-[40px] font-extrabold">{p.price}<span className={`text-[15px] font-medium ${p.dark ? "text-white/60" : m.pricingSub}`}>/mo</span></div>
                <div className={`text-sm ${p.dark ? "text-white/60" : m.pricingSub}`}>{p.sub}</div>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.feats.map((f) => (
                    <li key={f} className="flex gap-2"><Check className="w-[18px] h-[18px] shrink-0 text-[#D4FF4F]" /> {f}</li>
                  ))}
                </ul>
                <a href={ML.contact} className={`block text-center mt-6 px-4 py-2.5 rounded-full font-semibold ${p.dark ? "bg-[#D4FF4F] text-black hover:bg-[#c8f040]" : m.pricingGhost}`}>
                  Choose {p.name.charAt(0) + p.name.slice(1).toLowerCase()}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-6 sm:p-10 md:p-14 text-center">
            <h2 className="text-[28px] sm:text-[32px] md:text-[44px] font-extrabold leading-[1.08] text-black max-w-[720px] mx-auto">
              Let&apos;s start closing more work, today
            </h2>
            <p className="mt-3 sm:mt-4 text-[15px] text-black/70 max-w-[540px] mx-auto px-1">
              Open the platform or talk to sales — we&apos;ll set up a portal and show you Segmiq on a sample of your real leads.
            </p>
            <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 max-w-[320px] sm:max-w-none mx-auto">
              <a href={ML.login} className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90 text-center">Open the platform</a>
              <a href={ML.contact} className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5 text-center">Contact sales</a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
