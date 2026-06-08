/**
 * Segmiq CRM — product page body. Header/footer come from app/(marketing)/layout.tsx.
 * Route: /products/segmiq-crm
 */

import { Fragment } from "react";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata, softwareAppLd } from "@/lib/seo";
import { m } from "@/components/marketing/marketingTheme";
import { ML } from "@/lib/marketing-links";
import {
  Briefcase,
  Users,
  User,
  Send,
  TrendingUp,
  Route,
  MessageCircle,
  GraduationCap,
  Trophy,
  History,
  Tag,
  FileText,
  Target,
  ListChecks,
  Clock,
  Activity,
  BarChart3,
  Zap,
  ArrowRight,
} from "lucide-react";

export const metadata = pageMetadata({
  title: "Segmiq CRM — Capture, score, coach, and close in one platform",
  description: "Segmiq CRM runs your whole revenue motion across three connected portals: agency, manager, and salesperson.",
  path: "/products/segmiq-crm",
});

const PORTALS = [
  {
    Icon: Briefcase,
    k: "AGENCY ADMIN",
    t: "Run every client from one place",
    d: "A health grid across all clients, a pulse strip, alerts, and an activity feed. The agency sees which accounts are thriving and which need a call today.",
  },
  {
    Icon: Users,
    k: "CLIENT MANAGER",
    t: "Run your sales team",
    d: "Today's focus, team performance, pipeline, score distribution, assets sent, and recent wins — everything an owner or sales manager needs in a glance.",
  },
  {
    Icon: User,
    k: "SALESPERSON",
    t: "Know who to call next",
    d: "A priority lead list, a numbers strip, a quick log-call sheet, and a floating action button. The rep opens the app and knows exactly where to start.",
  },
];

const FLOW = [
  { Icon: Send, label: "Capture" },
  { Icon: TrendingUp, label: "Score" },
  { Icon: Route, label: "Route" },
  { Icon: MessageCircle, label: "Confirm" },
  { Icon: GraduationCap, label: "Coach" },
  { Icon: Trophy, label: "Win" },
];

const SCORES = [
  { label: "Solar — Borrowdale", pct: 88 },
  { label: "Roofing — Avondale", pct: 71 },
  { label: "Electrical — Mt Pleasant", pct: 64 },
];

const METRICS = [
  { value: "92", label: "intent score", className: "" },
  { value: "18m", label: "avg response", className: "text-[#D4FF4F]" },
  { value: "7", label: "hot leads", className: "" },
];

const CAPS = [
  { Icon: History, t: "Complete lead timeline", d: "Every call, message, and status change recorded against the lead — permanently." },
  { Icon: Send, t: "One-tap send panel", d: "Push portfolio, projects, pricing, testimonials, documents, or a custom message in seconds." },
  { Icon: Tag, t: "Pricing packages", d: "Build reusable pricing packages and attach them to a lead or a public profile." },
  { Icon: FileText, t: "Document library", d: "Keep proposals, brochures, and certificates ready to send from anywhere." },
  { Icon: Trophy, t: "Win analysis", d: "When a deal closes, Segmiq records why — and surfaces the pattern across wins." },
  { Icon: GraduationCap, t: "Onboarding coaching", d: "New reps get day 1, 3, and 7 coaching, so they produce sooner." },
  { Icon: Target, t: "Audience segments", d: "Six predefined segments plus custom filters, with Meta-ready CSV export." },
  { Icon: ListChecks, t: "Performance recommendations", d: "Seven rules watch response time, source mix, and follow-up compliance." },
  { Icon: Clock, t: "Stale lead recovery", d: "Cold leads are detected automatically and pushed into a recovery sequence." },
];

const DASHBOARDS = [
  {
    Icon: Activity,
    t: "Agency dashboard",
    d: "Client health grid, pulse strip, alerts banner, and a live activity feed across every account.",
  },
  {
    Icon: BarChart3,
    t: "Manager dashboard",
    d: "Today's focus, team performance, pipeline, score distribution, assets sent, and recent wins.",
  },
  {
    Icon: Zap,
    t: "Salesperson dashboard",
    d: "Priority lead list, numbers strip, quick log-call sheet, and recent activity — built for speed.",
  },
];

export default function SegmiqCrmPage() {
  return (
    <>
      <JsonLd
        data={[
          softwareAppLd({ name: "Segmiq CRM", description: "Segmiq CRM runs your whole revenue motion across three connected portals: agency, manager, and salesperson." }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Products", path: "/products/segmiq-crm" },
            { name: "Segmiq CRM", path: "/products/segmiq-crm" },
          ]),
        ]}
      />
      {/* HERO */}
      <section className="pt-20 pb-12">
        <div className="mx-auto max-w-[860px] px-5 text-center">
          <div className={m.kicker}>SEGMIQ CRM</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">
            Capture, score, coach, and close — in one platform
          </h1>
          <p className={`mt-5 text-[17px] ${m.muted} max-w-[640px] mx-auto`}>
            Segmiq CRM runs your entire revenue motion across three connected portals: the agency that manages clients, the manager who runs a sales team, and the rep closing work on the ground.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href={ML.contact} className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">
              Book a demo
            </a>
            <a href={ML.pricing} className={`px-6 py-3 ${m.ghostBtn}`}>
              See pricing
            </a>
          </div>
        </div>
      </section>

      {/* THREE PORTALS */}
      <section className="pb-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">One platform, three portals</h2>
          <p className={`text-center text-[15px] ${m.muted} mt-2 max-w-[560px] mx-auto`}>
            Each role gets a workspace built for the job in front of them — not one bloated screen for everyone.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-9">
            {PORTALS.map(({ Icon, k, t, d }) => (
              <div key={k} className={`${m.cardHover} p-6`}>
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
                  <Icon className="w-[22px] h-[22px]" />
                </span>
                <div className={`text-[11px] tracking-widest ${m.faint} font-semibold`}>{k}</div>
                <div className="mt-1 text-lg font-bold">{t}</div>
                <p className={`mt-2 text-sm ${m.muted}`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className={`py-16 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">How a lead moves through Segmiq</h2>
          <p className={`text-center text-[15px] ${m.muted} mt-2 max-w-[560px] mx-auto`}>
            From the moment a prospect fills the form to the moment the win is recorded.
          </p>

          {/* desktop */}
          <div className="mt-10 hidden md:flex items-center gap-2">
            {FLOW.map(({ Icon, label }, i) => (
              <Fragment key={label}>
                <div className="text-center">
                  <div className="grid place-items-center w-12 h-12 mx-auto rounded-xl bg-[#0C0C0C] text-[#D4FF4F]">
                    <Icon className="w-[22px] h-[22px]" />
                  </div>
                  <div className="mt-2 text-[13px] font-semibold">{label}</div>
                </div>
                {i < FLOW.length - 1 && <div className="flex-1 h-0.5 bg-gradient-to-r from-[#D4FF4F] to-white/10" />}
              </Fragment>
            ))}
          </div>

          {/* mobile */}
          <div className="md:hidden mt-8 grid grid-cols-3 gap-3">
            {FLOW.map(({ Icon, label }) => (
              <div key={label} className={`${m.card} p-3 text-center`}>
                <div className="grid place-items-center w-10 h-10 mx-auto rounded-xl bg-[#0C0C0C] text-[#D4FF4F]">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="mt-1.5 text-xs font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTELLIGENCE BAND */}
      <section className={`py-16 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#D4FF4F] text-black mb-4">
              <TrendingUp className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] sm:text-[32px] font-extrabold leading-tight">
              Every lead scored 0–100, the moment it lands
            </h2>
            <p className={`mt-3 text-[15px] ${m.muted}`}>
              The intelligence engine reads each enquiry for intent category, urgency, budget confidence, and project specificity — then turns it into a single score and a clear next action. Your reps stop guessing who&apos;s worth chasing.
            </p>
            <a
              href={ML.featuresIntelligence}
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-white/90"
            >
              See the intelligence layer <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="rounded-xl bg-[#0A0A14] border border-white/10 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff4444]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#f5a623]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3dd68c]" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {METRICS.map(({ value, label, className }) => (
                <div key={label || value} className="rounded-lg bg-[#181818] p-3">
                  <div className={`text-2xl font-extrabold ${className}`}>{value}</div>
                  <div className="text-[11px] text-white/50">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-[#181818] p-3 space-y-2">
              {SCORES.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-white/80">{s.label}</span>
                    <span className="text-[#D4FF4F] font-semibold">{s.pct}</span>
                  </div>
                  <div className="h-1.5 rounded bg-white/10">
                    <div className="h-full rounded bg-[#D4FF4F]" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">Everything the team needs to close</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-9">
            {CAPS.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.cardHover} p-5`}>
                <span className={`grid place-items-center w-10 h-10 rounded-xl ${m.cardIcon} text-white mb-3`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="font-semibold">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARDS */}
      <section className={`py-16 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">A dashboard built for each role</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-9">
            {DASHBOARDS.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.card} p-6`}>
                <span className="text-[#D4FF4F]">
                  <Icon className="w-[22px] h-[22px]" />
                </span>
                <div className="mt-3 font-bold">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-10 md:p-14 text-center">
            <h2 className="text-[32px] md:text-[40px] font-extrabold leading-[1.08] text-black max-w-[680px] mx-auto">
              See Segmiq CRM running on your pipeline
            </h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">
              We&apos;ll set up a portal, load a sample of your leads, and show you the scoring, routing, and coaching in action.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href={ML.contact} className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">
                Book a demo
              </a>
              <a href={ML.pricing} className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5">
                See pricing
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
