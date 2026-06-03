/**
 * Why Segmiq — page body. Header/footer come from app/(marketing)/layout.tsx.
 * Route: /why-segmiq
 *
 * Images are placeholder Unsplash URLs — replace with R2-hosted client photos.
 * If keeping remote URLs, add images.unsplash.com to next.config remotePatterns.
 */

import type { Metadata } from "next";
import Image from "next/image";
import { Route, MapPin, MessageCircle, Shield, Check, Send, Clock, Layers, History, Lock, Building2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Why Segmiq — Built for how service businesses in Africa win work",
  description: "Segmiq is built for service businesses across Africa — WhatsApp-first, secure, and made for how trades actually win work.",
};

const IMG = {
  construction: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=900&h=720&fit=crop&auto=format",
  team: "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?q=70&w=900&h=720&fit=crop&auto=format",
};

const STATS = [
  { n: "9×", t: "more likely to qualify a lead when the first response lands within five minutes. Most trade businesses take hours." },
  { n: "0", t: "leads, history, or relationships lost when a salesperson leaves. Everything stays on the platform, not in their phone." },
  { n: "1", t: "system from first enquiry to recorded win — capture, scoring, coaching, and reporting in one place." },
];

const SERVICE_POINTS = [
  "Conversational lead capture built for construction, solar, roofing, electrical, and landscaping",
  "One-tap portfolio, pricing, and document sending",
  "Win analysis that learns which quotes and sources actually close",
];

const WHATSAPP = [
  { Icon: Send, t: "Instant confirmation", d: "The prospect gets a branded confirmation the moment they submit, so they know they reached a real business." },
  { Icon: Clock, t: "Magic-link assignment", d: "The right rep gets the lead on WhatsApp with a one-tap link — no login friction, no lead sitting unseen." },
  { Icon: MessageCircle, t: "Daily AI coaching", d: "Each rep gets a short, specific coaching message every morning, built from their own pipeline." },
];

const SECURITY = [
  { Icon: Layers, t: "Three scoped portals", d: "Agency admin, client manager, and salesperson — one login each, scoped to what they need." },
  { Icon: History, t: "Every action on the timeline", d: "Each call, message, and status change is recorded against the lead — a full, permanent history." },
  { Icon: Lock, t: "Clean handovers", d: "When a rep leaves, a handover summary briefs the next person — nothing leaves with them." },
];

export default function WhySegmiqPage() {
  return (
    <>
      {/* HERO */}
      <section className="pt-20 pb-14">
        <div className="mx-auto max-w-[820px] px-5 text-center">
          <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">WHY SEGMIQ</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">Built for how service businesses in Africa actually win work</h1>
          <p className="mt-5 text-[17px] text-[#5b5b5b] max-w-[640px] mx-auto">
            Most sales software was built for software teams in San Francisco. Segmiq was built for a roofing company in Harare, a solar installer in Lusaka, and an electrical contractor in Johannesburg — where the first reply still arrives on WhatsApp.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#" className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Book a demo</a>
            <a href="#" className="px-6 py-3 rounded-full border border-black/[0.08] font-semibold hover:border-black/30">See pricing</a>
          </div>
        </div>
      </section>

      {/* STAT BAND */}
      <section className="pb-16">
        <div className="mx-auto max-w-[1100px] px-5 grid sm:grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-6">
              <div className="text-[44px] font-extrabold leading-none">{s.n}</div>
              <p className="mt-2 text-sm text-[#5b5b5b]">{s.t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PILLAR 1 — service businesses */}
      <section className="py-12 bg-[#F8F7F4]">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div className="relative h-[340px] rounded-2xl ring-1 ring-black/[0.08] overflow-hidden order-2 lg:order-1">
            <Image src={IMG.construction} alt="Trade work on site" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <div className="order-1 lg:order-2">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
              <Route className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] font-extrabold leading-tight">Not another generic CRM</h2>
            <p className="mt-3 text-[15px] text-[#5b5b5b]">
              Trades don&apos;t sell like SaaS. The work starts with a site enquiry, moves through a quote and a portfolio, and closes on trust. Segmiq follows that exact path: it captures the enquiry, scores its intent, routes it to the right rep, confirms the prospect, coaches the follow-up, and records the win — so the way you actually sell is the way the software works.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {SERVICE_POINTS.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="w-[18px] h-[18px] shrink-0 text-[#D4FF4F]" /> {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PILLAR 2 — built for Africa */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
              <MapPin className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] font-extrabold leading-tight">Built for Africa, not adapted for it</h2>
            <p className="mt-3 text-[15px] text-[#5b5b5b]">
              In Zimbabwe, Zambia, South Africa, and Kenya, business happens on WhatsApp — not email threads and dialler software. Segmiq runs on the Meta WhatsApp Cloud API with a Twilio fallback, so it works on the phone your rep already carries, on the network they already use. No new app for the prospect to download, no behaviour to change.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[13px] font-semibold text-[#5b5b5b]">
              {[
                "Harare",
                "Lusaka",
                "Johannesburg",
                "Nairobi",
              ].map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0EEE8]">
                  <Building2 className="w-[15px] h-[15px]" /> {c}
                </span>
              ))}
            </div>
          </div>
          <div className="relative h-[340px] rounded-2xl ring-1 ring-black/[0.08] overflow-hidden">
            <Image src={IMG.team} alt="Team working together" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* PILLAR 3 — WhatsApp-first */}
      <section className="py-16 bg-[#0C0C0C] text-white">
        <div className="mx-auto max-w-[1100px] px-5">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#D4FF4F] text-black mb-4">
            <MessageCircle className="w-[22px] h-[22px]" />
          </span>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold leading-tight max-w-[620px]">
            WhatsApp-first, because that&apos;s where the deal already lives
          </h2>
          <p className="mt-3 text-[15px] text-white/70 max-w-[620px]">
            Every key moment happens on the channel the prospect already checks — not buried in an inbox they never open.
          </p>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {WHATSAPP.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-xl bg-[#181818] p-5">
                <span className="text-[#D4FF4F]">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="mt-3 font-medium">{t}</div>
                <p className="text-sm text-white/65 mt-1">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-white/45">All templates are approved under the Segmiq brand and delivered through the official Meta WhatsApp Cloud API.</p>
        </div>
      </section>

      {/* PILLAR 4 — security */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="max-w-[620px]">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
              <Shield className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] font-extrabold leading-tight">Your pipeline stays yours</h2>
            <p className="mt-3 text-[15px] text-[#5b5b5b]">
              The biggest risk in a sales team isn&apos;t a missed lead — it&apos;s a salesperson walking out with every contact and conversation. Segmiq keeps the relationship on the business&apos;s side of the line.
            </p>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {SECURITY.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-xl border border-black/[0.08] p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#F0EEE8] text-[#0C0C0C] mb-3">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="font-medium">{t}</div>
                <p className="text-sm text-[#5b5b5b] mt-1">{d}</p>
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
              See what Segmiq finds in your own leads
            </h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">
              Bring a week of real enquiries. We&apos;ll show you the response times, the missed follow-ups, and the deals hiding in your pipeline.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#" className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">
                Book a demo
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-1 px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5"
              >
                See pricing <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
