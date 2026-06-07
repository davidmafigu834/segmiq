/**
 * All features — page body. Header/footer come from app/(marketing)/layout.tsx.
 * Route: /features
 * Server component (static content + anchor jump links).
 */

import type { Metadata } from "next";
import {
  MessageCircle, Send, History, Route, Link2, RefreshCw, Bell, Clock, GraduationCap, Mail,
  Tag, FileText, TrendingUp, Brain, Sparkles, Trophy, Gauge, ListChecks, Inbox, Filter, Target,
  Download, BarChart3, Activity, Briefcase, Users, Zap, Layers, KeyRound, Shield, ArrowRight,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "All features — Segmiq",
  description: "Everything in Segmiq: lead capture, WhatsApp automation, conversion tools, scoring & intelligence, recovery, segments, performance, dashboards, and security.",
};

type Item = { Icon: LucideIcon; t: string; d: string };
type Group = { id: string; title: string; blurb: string; items: Item[] };

const GROUPS: Group[] = [
  { id: "capture", title: "Lead capture", blurb: "Turn every enquiry into a tracked, owned record.", items: [
    { Icon: MessageCircle, t: "Conversational lead form", d: "A chat-style form that captures intent as it talks." },
    { Icon: Send, t: "Instant prospect confirmation", d: "A branded WhatsApp the moment a lead submits." },
    { Icon: History, t: "Complete lead timeline", d: "Every call, message, and status change, permanently." },
    { Icon: Route, t: "Handover notes", d: "Reassign a lead and the next rep gets full context." },
  ]},
  { id: "whatsapp", title: "WhatsApp automation", blurb: "Every key moment reaches the channel people actually check.", items: [
    { Icon: Link2, t: "Magic-link assignment", d: "New leads land with the right rep via a one-tap link." },
    { Icon: RefreshCw, t: "Magic-link renewal", d: "Expired links are safely renewed in a tap." },
    { Icon: Bell, t: "SLA breach warnings", d: "Alerts when a lead is going unanswered too long." },
    { Icon: Clock, t: "Follow-up reminders", d: "Nudges so no promised follow-up slips." },
    { Icon: GraduationCap, t: "Daily AI coaching", d: "A short, specific coaching message each morning." },
    { Icon: Mail, t: "Weekly manager digest", d: "A summary of the week in the inbox every Monday." },
  ]},
  { id: "convert", title: "Conversion tools", blurb: "Everything a rep needs to move a deal, in one tap.", items: [
    { Icon: Send, t: "One-tap send panel", d: "Portfolio, projects, pricing, testimonials, documents, or custom." },
    { Icon: Tag, t: "Pricing packages", d: "Reusable packages attached to a lead or profile." },
    { Icon: FileText, t: "Document library", d: "Proposals, brochures, and certificates ready to send." },
  ]},
  { id: "intelligence", title: "Scoring & intelligence", blurb: "Know who to call next, and why.", items: [
    { Icon: TrendingUp, t: "Lead scoring 0–100", d: "Rules-based on every plan; AI intent on Growth & Scale." },
    { Icon: Brain, t: "Lead intelligence", d: "Intent, urgency, budget confidence, specificity, and tags." },
    { Icon: Sparkles, t: "AI briefing & suggestions", d: "A quick brief and a suggested next message per lead." },
    { Icon: Trophy, t: "Win analysis", d: "When a deal closes, Segmiq records why — and finds the pattern." },
    { Icon: Gauge, t: "Weekly insights", d: "AI-generated insight from each client snapshot." },
    { Icon: ListChecks, t: "Form question AI", d: "Generate sharp qualifying questions for your form." },
  ]},
  { id: "recovery", title: "Recovery", blurb: "Bring cold leads back before they are lost.", items: [
    { Icon: Clock, t: "Stale lead detection", d: "Cold leads are flagged automatically." },
    { Icon: RefreshCw, t: "Recovery sequences", d: "Slipped leads move into a structured recovery flow." },
    { Icon: Inbox, t: "Stale-lead summary", d: "Managers see what is going cold across the team." },
  ]},
  { id: "segments", title: "Audience & export", blurb: "Turn your pipeline into ad-ready audiences.", items: [
    { Icon: Filter, t: "Predefined segments", d: "Six ready-made segments — won, never answered, high intent, more." },
    { Icon: Target, t: "Custom segments", d: "Build your own with filters across the pipeline." },
    { Icon: Download, t: "Meta-ready CSV export", d: "Export straight into Meta Ads, with export history." },
  ]},
  { id: "performance", title: "Performance intelligence", blurb: "See what is working and what to fix.", items: [
    { Icon: BarChart3, t: "Performance snapshots", d: "Weekly computed metrics per client." },
    { Icon: ListChecks, t: "Recommendations", d: "Seven rules on response time, source mix, follow-up, and more." },
    { Icon: Activity, t: "Performance trends", d: "Track the numbers moving over time." },
  ]},
  { id: "dashboards", title: "Dashboards", blurb: "A workspace built for each role.", items: [
    { Icon: Briefcase, t: "Agency dashboard", d: "Client health grid, pulse strip, alerts, activity feed." },
    { Icon: Users, t: "Manager dashboard", d: "Today's focus, team performance, pipeline, wins." },
    { Icon: Zap, t: "Salesperson dashboard", d: "Priority lead lanes, numbers strip, quick log-call sheet." },
  ]},
  { id: "security", title: "Accounts & security", blurb: "Scoped access, clean sign-in, nothing lost.", items: [
    { Icon: Layers, t: "Three scoped portals", d: "Agency, manager, and rep each see only what they need." },
    { Icon: KeyRound, t: "Secure sign-in", d: "NextAuth with a forgot-password flow on every portal." },
    { Icon: Mail, t: "Invite emails", d: "Bring on a teammate with an emailed invite." },
    { Icon: Shield, t: "Data ownership", d: "Full history retained; export anytime." },
  ]},
];

export default function FeaturesPage() {
  return (
    <div className="scroll-smooth">
      {/* HERO */}
      <section className="pt-20 pb-8">
        <div className="mx-auto max-w-[760px] px-5 text-center">
          <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">ALL FEATURES</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">Everything in Segmiq, in one place</h1>
          <p className="mt-5 text-[17px] text-[#5b5b5b] max-w-[600px] mx-auto">From the first enquiry to the recorded win — capture, conversion, intelligence, recovery, and the dashboards that hold it together.</p>
        </div>
        <div className="mx-auto max-w-[1100px] px-5 mt-7 flex flex-wrap justify-center gap-2 text-[13px] font-medium text-[#5b5b5b]">
          {GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="rounded-full border border-black/[0.08] px-3 py-1.5 hover:border-black/30 hover:text-black">{g.title}</a>
          ))}
        </div>
      </section>

      {/* GROUPS */}
      {GROUPS.map((g, i) => (
        <section key={g.id} id={g.id} className={`py-14 scroll-mt-20 ${i % 2 ? "bg-[#F8F7F4]" : ""}`}>
          <div className="mx-auto max-w-[1100px] px-5">
            <div className="max-w-[600px]">
              <h2 className="text-[26px] font-extrabold">{g.title}</h2>
              <p className="mt-2 text-[15px] text-[#5b5b5b]">{g.blurb}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {g.items.map(({ Icon, t, d }) => (
                <div key={t} className="rounded-2xl bg-white border border-black/[0.08] p-5 transition-transform duration-300 hover:-translate-y-1">
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4"><Icon className="w-[22px] h-[22px]" /></span>
                  <div className="font-semibold">{t}</div>
                  <p className="text-sm text-[#5b5b5b] mt-1">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CLOUD NOTE */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-[600px]">
              <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">RELATED PRODUCT</div>
              <h3 className="text-[22px] font-bold mt-1">Looking for project documentation and portfolios?</h3>
              <p className="mt-1.5 text-sm text-[#5b5b5b]">That lives in Segmiq Cloud — photo documentation, public profiles, and lead capture for trades. Separate product, shared login.</p>
            </div>
            <a href="https://cloud.segmiq.com" className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#0C0C0C] text-white font-semibold hover:opacity-90">Explore Segmiq Cloud <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-10 md:p-14 text-center">
            <h2 className="text-[32px] md:text-[40px] font-extrabold leading-[1.08] text-black max-w-[680px] mx-auto">See the whole platform on your pipeline</h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">Book a demo and we&apos;ll show you each piece working together on a sample of your real leads.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#" className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">Book a demo</a>
              <a href="#" className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5">See pricing</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
