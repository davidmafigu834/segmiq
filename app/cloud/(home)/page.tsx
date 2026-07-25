/**
 * Segmiq Cloud — landing page body for cloud.segmiq.com (served via /cloud, see middleware.ts).
 * Header/footer + Cloud theme come from app/cloud/(home)/layout.tsx. Server component.
 *
 * Cloud palette: cream #F7F4EF, card #fff, ink #1C1410, muted #8C7B6B, accent #D4FF4F,
 * dark #1C1410. Display type uses Tailwind `font-serif` (Instrument Serif).
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Check,
  ArrowRight,
  MessageCircle,
  Route,
  Globe,
  Image as ImageIcon,
  UploadCloud,
  Link2,
  Milestone,
  Smartphone,
  Briefcase,
  User,
  HardDrive,
  Droplet,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Segmiq Cloud — Document, share, and win more trade work",
  description:
    "Segmiq Cloud is where Africa's trade businesses document, store, and share projects professionally — and capture leads from a public portfolio.",
  alternates: { canonical: SITE.cloudUrl },
};

const IMG = {
  hero: "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1920&h=1280&fit=crop&auto=format",
  solar:
    "https://images.unsplash.com/photo-1745187946672-2c1d8cf26a2b?q=70&w=700&h=460&fit=crop&auto=format",
  electrician:
    "https://images.unsplash.com/photo-1758101755915-462eddc23f57?q=70&w=700&h=460&fit=crop&auto=format",
  house:
    "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=700&h=460&fit=crop&auto=format",
  construction:
    "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=700&h=460&fit=crop&auto=format",
  site: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=70&w=1200&h=800&fit=crop&auto=format",
};

const STAGES: [string, string, string, string][] = [
  ["Foundation", "12 Jan", "Excavation & footings poured", "3 days · 14m³ concrete"],
  ["Slab & walls", "03 Feb", "Block laying to lintel level", "9 days · 8 workers"],
  ["Roofing", "24 Feb", "Trusses & sheeting fitted", "5 days"],
  ["Finishing", "18 Mar", "Plaster, paint, fittings", "12 days"],
  ["Handover", "02 Apr", "Snag list cleared, keys handed over", "complete"],
];

const WHO = [
  {
    Icon: Smartphone,
    t: "The field worker",
    d: "Opens the app on site, picks photos, uploads. Under two minutes with dusty hands — the day's work documented before the drive home.",
  },
  {
    Icon: Briefcase,
    t: "The owner or manager",
    d: "Reviews what the team documented, manages the portfolio, shares links, and sees which projects prospects view most. Set up once, updates itself.",
  },
  {
    Icon: User,
    t: "The prospect",
    d: "Downloads nothing. Opens a link, sees a professional gallery, fills the form. Three minutes, and a strong impression of a serious company.",
  },
];

const INFRA = [
  {
    Icon: HardDrive,
    t: "Cloudflare R2 storage",
    d: "Photos stored redundantly across data centres. They don't vanish when a phone breaks or a worker leaves.",
  },
  {
    Icon: Smartphone,
    t: "Progressive web app",
    d: "Installs to any home screen in under 30 seconds, opens like a native app, and works on slow data.",
  },
  {
    Icon: Droplet,
    t: "Automatic watermarking",
    d: "Every photo can carry your logo — position, size, and opacity configurable. Your work can't be claimed by someone else.",
  },
];

const PLANS = [
  {
    n: "Starter",
    p: "$20",
    sub: "For a small operator getting started",
    pop: false,
    feats: [
      "50 GB storage",
      "Up to 3 team members",
      "Unlimited projects",
      "Public share links",
      "Basic watermarking",
      "Public profile page",
      "Mobile PWA app",
    ],
  },
  {
    n: "Professional",
    p: "$49",
    sub: "For a growing field team",
    pop: true,
    feats: [
      "200 GB storage",
      "Up to 10 team members",
      "Custom logo watermark",
      "Project analytics",
      "Priority support",
      "Everything in Starter",
    ],
  },
  {
    n: "Business",
    p: "$99",
    sub: "For an established contractor",
    pop: false,
    feats: [
      "1 TB storage",
      "Unlimited team members",
      "Custom domain",
      "Video URL embeds",
      "Testimonials manager",
      "CSV export",
      "Dedicated onboarding",
    ],
  },
];

function Thumb({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill sizes="240px" className="object-cover" />
    </div>
  );
}

export default async function SegmiqCloudPage() {
  const session = await getServerSession(authOptions);
  if (session?.userId) {
    redirect("/cloud/dashboard");
  }

  return (
    <>
      {/* HERO — full-bleed site photography, brand-first */}
      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-[#1C1410] text-[#F7F4EF]">
        <div className="absolute inset-0">
          <Image
            src={IMG.hero}
            alt="Solar installation on a rooftop at golden hour"
            fill
            priority
            sizes="100vw"
            className="cl-hero-media object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1410] via-[#1C1410]/72 to-[#1C1410]/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C1410]/55 via-transparent to-transparent" />
          <div className="cl-lime-glow pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-[#D4FF4F]/20 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1100px] flex-col justify-end px-5 pb-14 pt-24 sm:pb-20">
          <p className="cl-reveal font-serif text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] tracking-tight text-[#F7F4EF]">
            Segmiq{" "}
            <span className="italic text-[#D4FF4F]">Cloud</span>
          </p>
          <h1 className="cl-reveal cl-reveal-d1 mt-5 max-w-[18ch] font-serif text-[clamp(1.5rem,3.6vw,2.35rem)] font-normal leading-[1.15] text-[#F7F4EF]/92">
            Your best work, finally impossible to ignore
          </h1>
          <p className="cl-reveal cl-reveal-d2 mt-4 max-w-[34rem] text-[16px] leading-relaxed text-[#F7F4EF]/70 sm:text-[17px]">
            Document, store, and share trade projects professionally — so a
            messy WhatsApp thread never costs you another contract.
          </p>
          <div className="cl-reveal cl-reveal-d3 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/cloud/signup"
              className="inline-flex items-center gap-2 bg-[#D4FF4F] px-6 py-3.5 text-[15px] font-semibold text-[#1C1410] transition hover:brightness-105"
            >
              Book a demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#examples"
              className="inline-flex items-center border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-[#F7F4EF] transition hover:border-white/45 hover:bg-white/5"
            >
              See a live profile
            </a>
          </div>
        </div>
      </section>

      {/* THE PROBLEM — editorial, anchored by site photo */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1100px] items-end gap-10 px-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#8C7B6B]">
              THE PROBLEM
            </p>
            <h2 className="mt-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.12] tracking-tight">
              Remarkable work, invisible to the people who would pay for it
            </h2>
            <p className="mt-5 max-w-[36rem] text-[16px] leading-relaxed text-[#8C7B6B]">
              Photos scattered across employees&apos; phones. Years of finished
              jobs buried in WhatsApp groups nobody can find. When a prospect
              asks to see previous work, they get twelve unlabelled photos in a
              chat bubble — and have to imagine the company underneath the
              chaos.
            </p>
            <ul className="mt-8 space-y-3 border-l-2 border-[#1C1410]/10 pl-5 text-[14px] text-[#1C1410]">
              {[
                "IMG_4821.jpg",
                "IMG_4822.jpg",
                "WhatsApp Image 2024-...",
                "(sent in a group that's now full)",
              ].map((f, i) => (
                <li
                  key={f}
                  className={`flex items-center gap-2.5 ${i === 3 ? "text-[#8C7B6B]" : ""}`}
                >
                  <ImageIcon className="h-4 w-4 shrink-0 text-[#8C7B6B]" />
                  <span className={i === 3 ? "italic" : "font-medium"}>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="cl-photo-wrap relative aspect-[4/5] overflow-hidden sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src={IMG.site}
              alt="Construction site progress"
              fill
              sizes="(max-width: 1024px) 100vw, 480px"
              className="cl-photo object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1C1410]/40 to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 font-serif text-[22px] leading-snug text-white">
              Typical &ldquo;portfolio&rdquo; today lives in a chat nobody can
              search.
            </p>
          </div>
        </div>
      </section>

      {/* FIVE THINGS — intro */}
      <section id="features" className="scroll-mt-20 pb-4 pt-6">
        <div className="mx-auto max-w-[680px] px-5 text-center">
          <h2 className="font-serif text-[clamp(1.85rem,4vw,2.5rem)] leading-tight tracking-tight">
            Five things Segmiq Cloud does
          </h2>
          <p className="mt-3 text-[15px] text-[#8C7B6B]">
            From the photo taken on a dusty site to the contract signed by a
            corporate client.
          </p>
        </div>
      </section>

      {/* 1. STORE */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1C1410] font-serif text-lg font-bold text-[#D4FF4F]">
                1
              </span>
              <span className="text-xs font-semibold tracking-[0.16em] text-[#8C7B6B]">
                STORE
              </span>
            </div>
            <h3 className="mt-5 font-serif text-[clamp(1.6rem,3vw,2rem)] leading-tight">
              Store every project safely and permanently
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#8C7B6B]">
              The team uploads photos straight from their phones — on site,
              before they drive home. Everything is stored on Cloudflare R2 and
              organised by project, category, location, and date. In five years
              you have a complete, searchable record of every job — owned by the
              company.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Installs from the browser in under 30 seconds — no app store",
                "Works on slow mobile data, built for field conditions",
                "Redundant storage across multiple data centres",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#1C1410]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-[270px] overflow-hidden rounded-[36px] border-[7px] border-[#1C1410] bg-white shadow-[0_28px_80px_rgba(28,20,16,.22)]">
              <div className="h-7 bg-[#1C1410]" />
              <div className="p-4">
                <div className="text-[11px] text-[#8C7B6B]">Upload to project</div>
                <div className="font-serif text-[17px] font-bold">
                  Borrowdale Solar · 8kW
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <Thumb src={IMG.solar} alt="" className="h-16 rounded-md" />
                  <Thumb src={IMG.electrician} alt="" className="h-16 rounded-md" />
                  <Thumb src={IMG.house} alt="" className="h-16 rounded-md" />
                </div>
                <div className="mt-3 rounded-lg bg-[#F7F4EF] p-2.5 text-[12px]">
                  <div className="flex justify-between">
                    <span>Uploading 8 photos</span>
                    <span className="font-semibold text-[#1C1410]">86%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded bg-[#1C1410]/10">
                    <div className="h-full w-[86%] rounded bg-[#D4FF4F]" />
                  </div>
                </div>
                <div className="mt-3 inline-flex w-full items-center justify-center gap-1 text-center text-[11px] text-[#8C7B6B]">
                  <UploadCloud className="h-3.5 w-3.5" /> Backed up to Cloudflare
                  R2
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SHARE */}
      <section className="relative py-14 sm:py-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1C1410]/15 to-transparent" />
        <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 lg:grid-cols-2">
          <div className="order-2 overflow-hidden shadow-[0_28px_80px_rgba(28,20,16,.12)] ring-1 ring-[#1C1410]/10 lg:order-1">
            <div className="flex h-10 items-center gap-3 bg-[#e9e6e0] px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="mx-auto max-w-[300px] flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-[#8C7B6B]">
                borrowdale-solar/8kw-borrowdale
              </div>
            </div>
            <div className="bg-[#F7F4EF] p-5">
              <div className="font-serif text-[20px] font-bold">
                8kW Rooftop Solar — Borrowdale
              </div>
              <div className="mt-0.5 text-[12px] text-[#8C7B6B]">
                Completed March 2026 · Borrowdale, Harare
              </div>
              <Thumb src={IMG.solar} alt="" className="mt-3 h-40 rounded-lg" />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Thumb src={IMG.electrician} alt="" className="h-16 rounded-md" />
                <Thumb src={IMG.house} alt="" className="h-16 rounded-md" />
                <Thumb src={IMG.construction} alt="" className="h-16 rounded-md" />
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#1C1410] px-4 py-2 text-[13px] font-semibold text-[#D4FF4F]">
                <MessageCircle className="h-[15px] w-[15px]" /> Request a quote
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1C1410] font-serif text-lg font-bold text-[#D4FF4F]">
                2
              </span>
              <span className="text-xs font-semibold tracking-[0.16em] text-[#8C7B6B]">
                SHARE
              </span>
            </div>
            <h3 className="mt-5 font-serif text-[clamp(1.6rem,3vw,2rem)] leading-tight">
              Make completed work shareable in one link
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#8C7B6B]">
              Every project gets a public share link. One tap copies it; you send
              it on WhatsApp. The prospect opens a clean, professional page —
              title, location, completion date, every photo in order, and a
              button to request a quote. No login. No app to download.
            </p>
            <p className="mt-4 text-[15px] font-medium text-[#1C1410]">
              It replaces &quot;I&apos;ll send you some photos&quot; with
              something that looks like a serious, established business.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-[#8C7B6B]">
              <Link2 className="h-4 w-4 text-[#1C1410]" />
              Works on any phone, anywhere
            </div>
          </div>
        </div>
      </section>

      {/* 3. STORY — timeline */}
      <section id="how" className="scroll-mt-20 py-14 sm:py-16">
        <div className="mx-auto grid max-w-[1100px] items-start gap-12 px-5 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1C1410] font-serif text-lg font-bold text-[#D4FF4F]">
                3
              </span>
              <span className="text-xs font-semibold tracking-[0.16em] text-[#8C7B6B]">
                STORY
              </span>
            </div>
            <h3 className="mt-5 font-serif text-[clamp(1.6rem,3vw,2rem)] leading-tight">
              Tell the story of how the work was done
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#8C7B6B]">
              Every project can be documented as a timeline — milestones showing
              how the work progressed from empty land to handover. Each stage
              has a date, a description, its photos, and optional stats: workers
              on site, days taken, cubic metres poured.
            </p>
            <p className="mt-4 text-[15px] font-medium text-[#1C1410]">
              A prospect doesn&apos;t just see the finished building. They watch
              a construction documentary — and that is the difference between a
              gallery and a story.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-[#8C7B6B]">
              <Milestone className="h-4 w-4 text-[#1C1410]" />
              Stories build trust. Trust wins contracts.
            </div>
          </div>
          <div className="bg-white/70 p-6 ring-1 ring-[#1C1410]/10 backdrop-blur-sm sm:p-8">
            <div className="mb-5 font-serif text-[18px] font-bold">
              Four-bedroom build · Mt Pleasant
            </div>
            <div className="relative pl-7">
              <span className="cl-timeline-rail absolute bottom-1 left-[7px] top-1 w-[2px] bg-[#1C1410]/15" />
              {STAGES.map((s, i) => (
                <div
                  key={s[0]}
                  className={`relative ${i === STAGES.length - 1 ? "" : "pb-5"}`}
                >
                  <span
                    className={`absolute -left-7 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1C1410] ${
                      i === STAGES.length - 1 ? "bg-[#D4FF4F]" : "bg-white"
                    }`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-serif text-[15px] font-bold">{s[0]}</div>
                    <div className="text-[12px] text-[#8C7B6B]">{s[1]}</div>
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#8C7B6B]">{s[2]}</div>
                  <div className="mt-1 inline-block text-[11px] text-[#8C7B6B]">
                    {s[3]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. PORTFOLIO */}
      <section id="examples" className="scroll-mt-20 py-14 sm:py-16">
        <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1C1410] font-serif text-lg font-bold text-[#D4FF4F]">
                4
              </span>
              <span className="text-xs font-semibold tracking-[0.16em] text-[#8C7B6B]">
                PORTFOLIO
              </span>
            </div>
            <h3 className="mt-5 font-serif text-[clamp(1.6rem,3vw,2rem)] leading-tight">
              Build a professional public portfolio automatically
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#8C7B6B]">
              Every client gets a public profile at their own URL — company
              name, headline, featured projects pulled from what they upload,
              testimonials, and a lead form. The page builds itself from real
              work. You keep doing great work and uploading photos, and the
              portfolio grows on its own.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-[#8C7B6B]">
              <Globe className="h-4 w-4 text-[#1C1410]" />
              Your URL. Your brand. Zero design work.
            </div>
          </div>
          <div className="overflow-hidden shadow-[0_28px_80px_rgba(28,20,16,.12)] ring-1 ring-[#1C1410]/10">
            <div className="flex h-10 items-center gap-3 bg-[#e9e6e0] px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="mx-auto max-w-[280px] flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-[#8C7B6B]">
                borrowdale-solar
              </div>
            </div>
            <div className="bg-[#F7F4EF] p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center bg-[#D4FF4F] font-serif text-lg font-bold text-[#1C1410]">
                  BS
                </span>
                <div>
                  <div className="font-serif text-[20px] font-bold">
                    Borrowdale Solar Co
                  </div>
                  <div className="text-[12px] text-[#8C7B6B]">
                    Solar design &amp; installation · 120+ systems
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Thumb src={IMG.solar} alt="" className="h-20" />
                <Thumb src={IMG.house} alt="" className="h-20" />
                <Thumb src={IMG.electrician} alt="" className="h-20" />
              </div>
              <div className="mt-3 bg-white/80 p-3 text-[12px] text-[#8C7B6B]">
                &quot;Quoted same day, spotless install.&quot; — Homeowner ·{" "}
                <span className="italic">sample</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CAPTURE */}
      <section className="py-14 sm:py-16">
        <div className="relative mx-auto max-w-[1100px] overflow-hidden px-5">
          <div className="relative bg-[#1C1410] px-7 py-10 text-[#F7F4EF] sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D4FF4F]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-[#D4FF4F]/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#D4FF4F] font-serif text-lg font-bold text-[#1C1410]">
                  5
                </span>
                <span className="text-xs font-semibold tracking-[0.16em] text-[#D4FF4F]/80">
                  CAPTURE
                </span>
              </div>
              <h3 className="mt-5 max-w-[20ch] font-serif text-[clamp(1.7rem,3.2vw,2.25rem)] leading-tight">
                Capture leads directly from the portfolio
              </h3>
              <p className="mt-4 max-w-[36rem] text-[15px] leading-relaxed text-[#F7F4EF]/68">
                The lead form is a conversational, guided consultation. When the
                prospect submits, the lead drops into the Segmiq CRM pipeline.
                The sales team gets an instant WhatsApp notification; the
                prospect gets an automatic confirmation. You capture business
                while you sleep.
              </p>
              <div className="mt-9 grid gap-px bg-white/10 sm:grid-cols-4">
                {[
                  { Icon: Globe, t: "Visitor opens profile", on: false },
                  { Icon: MessageCircle, t: "Fills conversational form", on: false },
                  { Icon: Route, t: "Lands in Segmiq CRM", on: false },
                  { Icon: Check, t: "Team alerted on WhatsApp", on: true },
                ].map(({ Icon, t, on }) => (
                  <div
                    key={t}
                    className={`p-4 sm:p-5 ${on ? "bg-[#D4FF4F] text-[#1C1410]" : "bg-[#1C1410]"}`}
                  >
                    <span className={on ? "" : "text-[#D4FF4F]"}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div
                      className={`mt-2 text-sm ${on ? "font-semibold" : "font-medium text-[#F7F4EF]/85"}`}
                    >
                      {t}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHO USES IT */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-center font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-tight tracking-tight">
            Built for everyone who touches the job
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {WHO.map(({ Icon, t, d }, i) => (
              <div
                key={t}
                className={i > 0 ? "md:border-l md:border-[#1C1410]/10 md:pl-8" : ""}
              >
                <span className="grid h-11 w-11 place-items-center bg-[#1C1410] text-[#D4FF4F]">
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <div className="mt-4 font-serif text-[20px] font-bold">{t}</div>
                <p className="mt-2 text-sm leading-relaxed text-[#8C7B6B]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INFRASTRUCTURE */}
      <section className="border-y border-[#1C1410]/10 py-12">
        <div className="mx-auto grid max-w-[1100px] gap-8 px-5 sm:grid-cols-3 sm:gap-6">
          {INFRA.map(({ Icon, t, d }) => (
            <div key={t}>
              <span className="text-[#1C1410]">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <div className="mt-3 font-serif text-[17px] font-bold">{t}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#8C7B6B]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-center font-serif text-[clamp(1.85rem,4vw,2.5rem)] tracking-tight">
            Segmiq Cloud pricing
          </h2>
          <p className="mt-3 text-center text-[15px] text-[#8C7B6B]">
            Three plans, no free tier. Annual billing gets two months free.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((pl) => (
              <div
                key={pl.n}
                className={`p-7 transition-transform duration-300 hover:-translate-y-1 ${
                  pl.pop
                    ? "bg-[#1C1410] text-[#F7F4EF] shadow-[0_28px_60px_rgba(28,20,16,.25)]"
                    : "bg-white/60 ring-1 ring-[#1C1410]/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`text-[13px] font-semibold tracking-wide ${
                      pl.pop ? "text-[#D4FF4F]" : "text-[#8C7B6B]"
                    }`}
                  >
                    {pl.n.toUpperCase()}
                  </div>
                  {pl.pop && (
                    <span className="bg-[#D4FF4F] px-2 py-0.5 text-[11px] font-semibold text-[#1C1410]">
                      Most popular
                    </span>
                  )}
                </div>
                <div className="mt-3 font-serif text-[42px] font-bold leading-none">
                  {pl.p}
                  <span
                    className={`text-[15px] font-normal ${
                      pl.pop ? "text-[#F7F4EF]/70" : "text-[#8C7B6B]"
                    }`}
                  >
                    /mo
                  </span>
                </div>
                <div
                  className={`mt-2 text-sm ${pl.pop ? "text-[#F7F4EF]/70" : "text-[#8C7B6B]"}`}
                >
                  {pl.sub}
                </div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {pl.feats.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-[18px] w-[18px] shrink-0 text-[#D4FF4F]" />{" "}
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/cloud/signup"
                  className={`mt-7 block px-4 py-3 text-center text-[14px] font-semibold ${
                    pl.pop
                      ? "bg-[#D4FF4F] text-[#1C1410]"
                      : "bg-[#1C1410] text-[#D4FF4F]"
                  }`}
                >
                  Choose {pl.n}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-7 text-center text-[13px] text-[#8C7B6B]">
            Separate from Segmiq CRM plans. The two products share one login and
            database.
          </p>
        </div>
      </section>

      {/* CRM CONNECTION */}
      <section className="pb-10">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="grid items-center gap-6 border-y border-[#1C1410]/10 py-10 md:grid-cols-[1fr_auto] md:gap-10">
            <div>
              <div className="text-xs font-semibold tracking-[0.18em] text-[#8C7B6B]">
                WORKS WITH SEGMIQ CRM
              </div>
              <h2 className="mt-2 font-serif text-[clamp(1.5rem,3vw,1.85rem)] leading-tight">
                One half of a complete revenue system
              </h2>
              <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-[#8C7B6B]">
                Segmiq CRM brings leads in through advertising and outreach.
                Segmiq Cloud converts them by showing the quality of the work.
                Shared login, shared database — from the first ad impression to
                the signed contract.
              </p>
            </div>
            <a
              href="https://segmiq.com"
              className="inline-flex shrink-0 items-center gap-2 bg-[#1C1410] px-5 py-3.5 text-[14px] font-semibold text-[#D4FF4F] transition hover:brightness-110"
            >
              Explore Segmiq CRM <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        <div className="absolute inset-0">
          <Image
            src={IMG.construction}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-[#D4FF4F]/92" />
        </div>
        <div className="relative z-10 mx-auto max-w-[720px] px-5 text-center">
          <h2 className="font-serif text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.06] tracking-tight text-[#1C1410]">
            Get your portfolio live this week
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-relaxed text-[#1C1410]/70">
            Send us your projects. We&apos;ll set up your Segmiq Cloud profile
            and wire the lead form straight into your pipeline.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cloud/signup"
              className="inline-flex items-center gap-2 bg-[#1C1410] px-6 py-3.5 text-[15px] font-semibold text-[#D4FF4F] transition hover:brightness-110"
            >
              Book a demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#examples"
              className="border border-[#1C1410]/30 px-6 py-3.5 text-[15px] font-semibold text-[#1C1410] transition hover:bg-[#1C1410]/5"
            >
              See a live profile
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
