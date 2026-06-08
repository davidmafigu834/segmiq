/**
 * Segmiq Cloud — landing page body for cloud.segmiq.com (served via /cloud, see middleware.ts).
 * Header/footer + Cloud theme come from app/cloud/(home)/layout.tsx. Server component.
 *
 * Cloud palette: cream #F7F4EF, card #fff, ink #1C1410, muted #8C7B6B, accent #D4FF4F,
 * dark #1C1410. Display type uses Tailwind `font-serif` (Georgia-led stack).
 *
 * Images are placeholder Unsplash URLs — replace with R2-hosted client photos. Add
 * images.unsplash.com to next.config remotePatterns if keeping remote URLs.
 */

import type { Metadata } from "next";
import Image from "next/image";
import {
  Check, ArrowRight, MessageCircle, Route, Globe, Image as ImageIcon, UploadCloud,
  Link2, Milestone, Smartphone, Briefcase, User, HardDrive, Droplet,
} from "lucide-react";

import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Segmiq Cloud — Document, share, and win more trade work",
  description: "Segmiq Cloud is where Africa's trade businesses document, store, and share projects professionally — and capture leads from a public portfolio.",
  alternates: { canonical: SITE.cloudUrl },
};

const IMG = {
  solar: "https://images.unsplash.com/photo-1745187946672-2c1d8cf26a2b?q=70&w=700&h=460&fit=crop&auto=format",
  electrician: "https://images.unsplash.com/photo-1758101755915-462eddc23f57?q=70&w=700&h=460&fit=crop&auto=format",
  house: "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=700&h=460&fit=crop&auto=format",
  construction: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=700&h=460&fit=crop&auto=format",
};

const STAGES: [string, string, string, string][] = [
  ["Foundation", "12 Jan", "Excavation & footings poured", "3 days · 14m³ concrete"],
  ["Slab & walls", "03 Feb", "Block laying to lintel level", "9 days · 8 workers"],
  ["Roofing", "24 Feb", "Trusses & sheeting fitted", "5 days"],
  ["Finishing", "18 Mar", "Plaster, paint, fittings", "12 days"],
  ["Handover", "02 Apr", "Snag list cleared, keys handed over", "complete"],
];

const WHO = [
  { Icon: Smartphone, t: "The field worker", d: "Opens the app on site, picks photos, uploads. Under two minutes with dusty hands — the day's work documented before the drive home." },
  { Icon: Briefcase, t: "The owner or manager", d: "Reviews what the team documented, manages the portfolio, shares links, and sees which projects prospects view most. Set up once, updates itself." },
  { Icon: User, t: "The prospect", d: "Downloads nothing. Opens a link, sees a professional gallery, fills the form. Three minutes, and a strong impression of a serious company." },
];

const INFRA = [
  { Icon: HardDrive, t: "Cloudflare R2 storage", d: "Photos stored redundantly across data centres. They don't vanish when a phone breaks or a worker leaves." },
  { Icon: Smartphone, t: "Progressive web app", d: "Installs to any home screen in under 30 seconds, opens like a native app, and works on slow data." },
  { Icon: Droplet, t: "Automatic watermarking", d: "Every photo can carry your logo — position, size, and opacity configurable. Your work can't be claimed by someone else." },
];

const PLANS = [
  { n: "Starter", p: "$20", sub: "For a small operator getting started", pop: false, feats: ["50 GB storage", "Up to 3 team members", "Unlimited projects", "Public share links", "Basic watermarking", "Public profile page", "Mobile PWA app"] },
  { n: "Professional", p: "$49", sub: "For a growing field team", pop: true, feats: ["200 GB storage", "Up to 10 team members", "Custom logo watermark", "Project analytics", "Priority support", "Everything in Starter"] },
  { n: "Business", p: "$99", sub: "For an established contractor", pop: false, feats: ["1 TB storage", "Unlimited team members", "Custom domain", "Video URL embeds", "Testimonials manager", "CSV export", "Dedicated onboarding"] },
];

function Thumb({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill sizes="240px" className="object-cover" />
    </div>
  );
}

export default function SegmiqCloudPage() {
  return (
    <>
      {/* HERO */}
      <section className="pt-20 pb-10">
        <div className="mx-auto max-w-[860px] px-5 text-center">
          <div className="text-xs tracking-widest font-semibold text-[#8C7B6B]">SEGMIQ CLOUD · cloud.segmiq.com</div>
          <h1 className="font-serif mt-4 text-[40px] sm:text-[56px] leading-[1.04] font-bold tracking-tight">Your best work, finally impossible to ignore</h1>
          <p className="mt-5 text-[17px] text-[#8C7B6B] max-w-[640px] mx-auto">Segmiq Cloud is where Africa&apos;s trade businesses document, store, and share their projects professionally — so a disorganised WhatsApp message never costs you another contract.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#" className="px-6 py-3 rounded-full font-semibold bg-[#1C1410] text-[#D4FF4F]">Book a demo</a>
            <a href="#examples" className="px-6 py-3 rounded-full border border-[#1C1410]/10 font-semibold hover:border-[#1C1410]/30">See a live profile</a>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="pb-14">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-2xl bg-white border border-[#1C1410]/10 p-8 md:p-10 grid md:grid-cols-[1.1fr_1fr] gap-8 items-center">
            <div>
              <div className="text-xs tracking-widest font-semibold text-[#8C7B6B]">THE PROBLEM</div>
              <h2 className="font-serif text-[26px] sm:text-[30px] leading-tight mt-2">Remarkable work, invisible to the people who would pay for it</h2>
              <p className="mt-3 text-[15px] text-[#8C7B6B]">Photos scattered across employees&apos; phones. Years of finished jobs buried in WhatsApp groups nobody can find. And when a prospect asks to see previous work, they get twelve unlabelled photos in a chat bubble — and have to imagine the professional company underneath the chaos.</p>
            </div>
            <div className="rounded-xl p-5 bg-[#F7F4EF]">
              <div className="text-[13px] font-semibold mb-3 text-[#8C7B6B]">Typical &quot;portfolio&quot; today</div>
              <div className="space-y-2 text-sm">
                {["IMG_4821.jpg", "IMG_4822.jpg", "WhatsApp Image 2024-...", "(sent in a group that's now full)"].map((f, i) => (
                  <div key={f} className={`flex gap-2 ${i === 3 ? "opacity-50" : ""}`}>
                    <span className="text-[#8C7B6B]"><ImageIcon className="w-4 h-4" /></span> <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FIVE THINGS — intro */}
      <section id="features" className="py-6 scroll-mt-20">
        <div className="mx-auto max-w-[680px] px-5 text-center">
          <h2 className="font-serif text-[30px] sm:text-[36px] leading-tight">Five things Segmiq Cloud does</h2>
          <p className="mt-3 text-[15px] text-[#8C7B6B]">From the photo taken on a dusty site to the contract signed by a corporate client.</p>
        </div>
      </section>

      {/* 1. STORE */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#1C1410] text-[#D4FF4F] font-serif font-bold">1</span>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#D4FF4F] text-[#1C1410]"><UploadCloud className="w-5 h-5" /></span>
            </div>
            <h3 className="font-serif text-[26px] leading-tight mt-4">Store every project safely and permanently</h3>
            <p className="mt-3 text-[15px] text-[#8C7B6B]">The team uploads photos straight from their phones — on site, before they drive home. Everything is stored on Cloudflare R2 and organised by project, category, location, and date. Photos never disappear when a phone breaks or an employee leaves. In five years you have a complete, searchable record of every job — owned by the company.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {["Installs from the browser in under 30 seconds — no app store", "Works on slow mobile data, built for field conditions", "Redundant storage across multiple data centres"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="w-[18px] h-[18px] text-[#D4FF4F] shrink-0" /> {t}</li>
              ))}
            </ul>
          </div>
          {/* phone mockup */}
          <div className="flex justify-center">
            <div className="w-[260px] rounded-[34px] border-[6px] border-[#1C1410] bg-white overflow-hidden shadow-[0_24px_60px_rgba(28,20,16,.18)]">
              <div className="h-6 bg-[#1C1410]" />
              <div className="p-4">
                <div className="text-[11px] text-[#8C7B6B]">Upload to project</div>
                <div className="font-serif text-[16px] font-bold">Borrowdale Solar · 8kW</div>
                <div className="grid grid-cols-3 gap-1.5 mt-3">
                  <Thumb src={IMG.solar} alt="" className="h-16 rounded-md" />
                  <Thumb src={IMG.electrician} alt="" className="h-16 rounded-md" />
                  <Thumb src={IMG.house} alt="" className="h-16 rounded-md" />
                </div>
                <div className="mt-3 rounded-lg p-2.5 text-[12px] bg-[#F7F4EF]">
                  <div className="flex justify-between"><span>Uploading 8 photos</span><span className="text-[#1C1410] font-semibold">86%</span></div>
                  <div className="h-1.5 rounded bg-[#1C1410]/10 mt-1.5"><div className="h-full w-[86%] rounded bg-[#D4FF4F]" /></div>
                </div>
                <div className="mt-3 text-center text-[11px] text-[#8C7B6B] inline-flex items-center gap-1 w-full justify-center"><UploadCloud className="w-3.5 h-3.5" /> Backed up to Cloudflare R2</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SHARE */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div className="rounded-2xl overflow-hidden ring-1 ring-[#1C1410]/10 order-2 lg:order-1 shadow-[0_24px_60px_rgba(28,20,16,.10)]">
            <div className="flex items-center gap-3 px-4 h-10 bg-[#e9e6e0]">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" /></div>
              <div className="flex-1 max-w-[300px] mx-auto bg-white rounded-md text-[11px] text-[#8C7B6B] px-3 py-1 text-center truncate">cloud.segmiq.com/borrowdale-solar/8kw-borrowdale</div>
            </div>
            <div className="p-5 bg-[#F7F4EF]">
              <div className="font-serif text-[20px] font-bold">8kW Rooftop Solar — Borrowdale</div>
              <div className="text-[12px] text-[#8C7B6B] mt-0.5">Completed March 2026 · Borrowdale, Harare</div>
              <Thumb src={IMG.solar} alt="" className="h-40 rounded-lg mt-3" />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Thumb src={IMG.electrician} alt="" className="h-16 rounded-md" />
                <Thumb src={IMG.house} alt="" className="h-16 rounded-md" />
                <Thumb src={IMG.construction} alt="" className="h-16 rounded-md" />
              </div>
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold bg-[#1C1410] text-[#D4FF4F]"><MessageCircle className="w-[15px] h-[15px]" /> Request a quote</div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#1C1410] text-[#D4FF4F] font-serif font-bold">2</span>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#D4FF4F] text-[#1C1410]"><Link2 className="w-5 h-5" /></span>
            </div>
            <h3 className="font-serif text-[26px] leading-tight mt-4">Make completed work shareable in one link</h3>
            <p className="mt-3 text-[15px] text-[#8C7B6B]">Every project gets a public share link. One tap copies it; you send it on WhatsApp. The prospect opens a clean, professional page — title, location, completion date, every photo in order, and a button to request a quote. No login. No app to download. Just a link that works on any phone, anywhere.</p>
            <p className="mt-3 text-[15px] text-[#1C1410] font-medium">It replaces &quot;I&apos;ll send you some photos&quot; with something that looks like a serious, established business.</p>
          </div>
        </div>
      </section>

      {/* 3. STORY — timeline */}
      <section id="how" className="py-12 scroll-mt-20">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#1C1410] text-[#D4FF4F] font-serif font-bold">3</span>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#D4FF4F] text-[#1C1410]"><Milestone className="w-5 h-5" /></span>
            </div>
            <h3 className="font-serif text-[26px] leading-tight mt-4">Tell the story of how the work was done</h3>
            <p className="mt-3 text-[15px] text-[#8C7B6B]">Every project can be documented as a timeline — milestones showing how the work progressed from empty land to handover. Each stage has a date, a description, its photos, and optional stats: workers on site, days taken, cubic metres poured.</p>
            <p className="mt-3 text-[15px] text-[#1C1410] font-medium">A prospect doesn&apos;t just see the finished building. They watch a construction documentary — and that is the difference between a gallery and a story. Stories build trust. Trust wins contracts.</p>
          </div>
          <div className="rounded-2xl bg-white border border-[#1C1410]/10 p-6">
            <div className="font-serif text-[18px] font-bold mb-4">Four-bedroom build · Mt Pleasant</div>
            <div className="relative pl-7">
              <span className="absolute left-[7px] top-1 bottom-1 w-[2px] bg-[#1C1410]/10" />
              {STAGES.map((s, i) => (
                <div key={s[0]} className={`relative ${i === STAGES.length - 1 ? "" : "pb-5"}`}>
                  <span className={`absolute -left-7 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1C1410] ${i === STAGES.length - 1 ? "bg-[#D4FF4F]" : "bg-white"}`} />
                  <div className="flex items-center justify-between">
                    <div className="font-serif font-bold text-[15px]">{s[0]}</div>
                    <div className="text-[12px] text-[#8C7B6B]">{s[1]}</div>
                  </div>
                  <div className="text-[13px] text-[#8C7B6B] mt-0.5">{s[2]}</div>
                  <div className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-[#F7F4EF] text-[#8C7B6B]">{s[3]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. PORTFOLIO */}
      <section id="examples" className="py-12 bg-white scroll-mt-20">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#1C1410] text-[#D4FF4F] font-serif font-bold">4</span>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#D4FF4F] text-[#1C1410]"><Globe className="w-5 h-5" /></span>
            </div>
            <h3 className="font-serif text-[26px] leading-tight mt-4">Build a professional public portfolio automatically</h3>
            <p className="mt-3 text-[15px] text-[#8C7B6B]">Every client gets a public profile at their own URL — company name, headline, featured projects pulled from what they upload, testimonials, and a lead form. The page builds itself from real work. You don&apos;t design it or maintain it. You keep doing great work and uploading photos, and the portfolio grows on its own.</p>
          </div>
          <div className="rounded-2xl overflow-hidden ring-1 ring-[#1C1410]/10 shadow-[0_24px_60px_rgba(28,20,16,.10)]">
            <div className="flex items-center gap-3 px-4 h-10 bg-[#e9e6e0]">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" /></div>
              <div className="flex-1 max-w-[280px] mx-auto bg-white rounded-md text-[11px] text-[#8C7B6B] px-3 py-1 text-center truncate">cloud.segmiq.com/borrowdale-solar</div>
            </div>
            <div className="p-6 bg-[#F7F4EF]">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#D4FF4F] text-[#1C1410] font-serif font-bold">BS</span>
                <div>
                  <div className="font-serif text-[20px] font-bold">Borrowdale Solar Co</div>
                  <div className="text-[12px] text-[#8C7B6B]">Solar design &amp; installation · 120+ systems</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Thumb src={IMG.solar} alt="" className="h-20 rounded-md" />
                <Thumb src={IMG.house} alt="" className="h-20 rounded-md" />
                <Thumb src={IMG.electrician} alt="" className="h-20 rounded-md" />
              </div>
              <div className="mt-3 rounded-lg bg-white p-3 text-[12px] text-[#8C7B6B]">&quot;Quoted same day, spotless install.&quot; — Homeowner · <span className="italic">sample</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CAPTURE */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-2xl p-8 md:p-10 bg-[#1C1410] text-[#F7F4EF]">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#D4FF4F] text-[#1C1410] font-serif font-bold">5</span>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/[0.08] text-[#D4FF4F]"><MessageCircle className="w-5 h-5" /></span>
            </div>
            <h3 className="font-serif text-[26px] sm:text-[30px] leading-tight mt-4 max-w-[640px]">Capture leads directly from the portfolio</h3>
            <p className="mt-3 text-[15px] max-w-[640px] text-[#F7F4EF]/72">The lead form isn&apos;t a government application — it&apos;s a conversational, guided consultation. When the prospect submits, the lead drops straight into the Segmiq CRM pipeline. The sales team gets an instant WhatsApp notification with a link to the lead; the prospect gets an automatic confirmation. You capture business while you sleep.</p>
            <div className="mt-7 grid sm:grid-cols-4 gap-3">
              {[
                { Icon: Globe, t: "Visitor opens profile", on: false },
                { Icon: MessageCircle, t: "Fills conversational form", on: false },
                { Icon: Route, t: "Lands in Segmiq CRM", on: false },
                { Icon: Check, t: "Team alerted on WhatsApp", on: true },
              ].map(({ Icon, t, on }) => (
                <div key={t} className={`rounded-xl p-4 ${on ? "bg-[#D4FF4F] text-[#1C1410]" : "bg-white/[0.06]"}`}>
                  <span className={on ? "" : "text-[#D4FF4F]"}><Icon className="w-5 h-5" /></span>
                  <div className={`mt-2 text-sm ${on ? "font-semibold" : "font-medium"}`}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHO USES IT */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="font-serif text-[28px] text-center">Built for everyone who touches the job</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {WHO.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-[#1C1410]/10 p-6 bg-[#F7F4EF] transition-transform duration-300 hover:-translate-y-1">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#1C1410] text-[#D4FF4F] mb-4"><Icon className="w-[22px] h-[22px]" /></span>
                <div className="font-serif text-[18px] font-bold">{t}</div>
                <p className="text-sm text-[#8C7B6B] mt-1">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INFRASTRUCTURE */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5 grid sm:grid-cols-3 gap-4">
          {INFRA.map(({ Icon, t, d }) => (
            <div key={t} className="rounded-2xl bg-white border border-[#1C1410]/10 p-6">
              <span className="text-[#1C1410]"><Icon className="w-[22px] h-[22px]" /></span>
              <div className="font-serif text-[17px] font-bold mt-3">{t}</div>
              <p className="text-sm text-[#8C7B6B] mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-14 bg-white scroll-mt-20">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="font-serif text-[32px] text-center">Segmiq Cloud pricing</h2>
          <p className="text-center text-[15px] text-[#8C7B6B] mt-2">Three plans, no free tier. Annual billing gets two months free.</p>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {PLANS.map((pl) => (
              <div key={pl.n} className={`rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 ${pl.pop ? "bg-[#1C1410] text-[#F7F4EF]" : "bg-[#F7F4EF] border border-[#1C1410]/10"}`}>
                <div className="flex items-center justify-between">
                  <div className={`text-[13px] font-semibold tracking-wide ${pl.pop ? "text-[#D4FF4F]" : "text-[#8C7B6B]"}`}>{pl.n.toUpperCase()}</div>
                  {pl.pop && <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#D4FF4F] text-[#1C1410]">Most popular</span>}
                </div>
                <div className="font-serif text-[40px] font-bold mt-2">{pl.p}<span className={`text-[15px] font-normal ${pl.pop ? "text-[#F7F4EF]/70" : "text-[#8C7B6B]"}`}>/mo</span></div>
                <div className={`text-sm ${pl.pop ? "text-[#F7F4EF]/70" : "text-[#8C7B6B]"}`}>{pl.sub}</div>
                <ul className="mt-5 space-y-2 text-sm">
                  {pl.feats.map((f) => (
                    <li key={f} className="flex gap-2"><Check className="w-[18px] h-[18px] text-[#D4FF4F] shrink-0" /> {f}</li>
                  ))}
                </ul>
                <a href="#" className={`block text-center mt-6 px-4 py-2.5 rounded-full font-semibold ${pl.pop ? "bg-[#D4FF4F] text-[#1C1410]" : "bg-[#1C1410] text-[#D4FF4F]"}`}>Choose {pl.n}</a>
              </div>
            ))}
          </div>
          <p className="text-center text-[13px] text-[#8C7B6B] mt-6">Separate from Segmiq CRM plans. The two products share one login and database.</p>
        </div>
      </section>

      {/* CRM CONNECTION */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-2xl border border-[#1C1410]/10 bg-white p-8 md:p-10 grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-xs tracking-widest font-semibold text-[#8C7B6B]">WORKS WITH SEGMIQ CRM</div>
              <h2 className="font-serif text-[24px] sm:text-[28px] leading-tight mt-2">One half of a complete revenue system</h2>
              <p className="mt-3 text-[15px] text-[#8C7B6B] max-w-[620px]">Segmiq CRM brings leads in through advertising and outreach. Segmiq Cloud converts them by showing the quality of the work. Shared login, shared database — from the first ad impression to the signed contract.</p>
            </div>
            <a href="https://segmiq.com" className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full font-semibold bg-[#1C1410] text-[#D4FF4F]">Explore Segmiq CRM <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl p-10 md:p-14 text-center bg-[#D4FF4F]">
            <h2 className="font-serif text-[32px] md:text-[42px] leading-[1.06] font-bold text-[#1C1410] max-w-[680px] mx-auto">Get your portfolio live this week</h2>
            <p className="mt-3 text-[15px] text-[#1C1410]/70 max-w-[520px] mx-auto">Send us your projects. We&apos;ll set up your Segmiq Cloud profile and wire the lead form straight into your pipeline.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#" className="px-6 py-3 rounded-full font-semibold bg-[#1C1410] text-[#D4FF4F]">Book a demo</a>
              <a href="#examples" className="px-6 py-3 rounded-full border border-[#1C1410]/25 text-[#1C1410] font-semibold hover:bg-black/5">See a live profile</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
