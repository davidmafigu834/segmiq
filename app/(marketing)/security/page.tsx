/**
 * Security — page body. Header/footer come from app/(marketing)/layout.tsx.
 * Route: /security
 *
 * NOTE: claims here are limited to practices the platform actually implements.
 * Do NOT add compliance badges (SOC 2 / ISO / GDPR-certified) unless truly held.
 */

import { Layers, History, Lock, Download, Key, UserCheck, Clock, Server, Database, Eye, MessageCircle, Mail, Send, Shield, Check } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { m } from "@/components/marketing/marketingTheme";
import { ML } from "@/lib/marketing-links";

export const metadata = pageMetadata({
  title: "Security",
  description: "How Segmiq protects your pipeline: scoped access, full audit trail, official messaging channels, and data you can export at any time.",
  path: "/security",
});

const PRINCIPLES = [
  { Icon: Layers, t: "Least-privilege access", d: "Three scoped portals. Everyone sees only what their role needs." },
  { Icon: History, t: "Full audit trail", d: "Every action on a lead is recorded — permanently and traceably." },
  { Icon: Lock, t: "Encrypted in transit", d: "All traffic moves over TLS, on managed, reputable infrastructure." },
  { Icon: Download, t: "No lock-in", d: "Export your data whenever you want. It's yours, not ours." },
];

const ACCESS = [
  { Icon: Layers, t: "Role-based portals", d: "Agency admin, client manager, and salesperson each get a separate, scoped view." },
  { Icon: UserCheck, t: "Managed authentication", d: "Sign-in runs through NextAuth, with a secure forgot-password flow on every portal." },
  { Icon: Clock, t: "Expiring magic links", d: "Lead-assignment links expire, and reps can request a safe renewal when they do." },
];

const DATA = [
  { Icon: Database, t: "Managed PostgreSQL", d: "Lead and account data lives in a managed Postgres database with row-level controls." },
  { Icon: Lock, t: "Private file storage", d: "Documents and portfolio assets are stored privately and served over secure links." },
  { Icon: Eye, t: "Traceable activity", d: "The lead timeline gives you a clear record of who did what, and when." },
];

const COMMS = [
  { Icon: MessageCircle, t: "Official Meta WhatsApp Cloud API", d: "All templates are approved under the Segmiq brand, with a Twilio fallback for reliability." },
  { Icon: Mail, t: "Authenticated email", d: "Invites and notifications are sent through a reputable transactional email provider." },
  { Icon: Send, t: "No grey routes", d: "We never use unofficial gateways — your number stays clean and compliant." },
];

const OWNERSHIP = [
  "Meta-compatible CSV export of any audience segment",
  "Handover summaries keep knowledge in the business, not the rep's phone",
  "Full lead history retained for every contact",
];

export default function SecurityPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Security", path: "/security" }])} />
      {/* HERO */}
      <section className="pt-20 pb-14">
        <div className="mx-auto max-w-[820px] px-5 text-center">
          <div className={m.kicker}>SECURITY</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">
            Your leads, your data, your relationships — protected
          </h1>
          <p className={`mt-5 text-[17px] ${m.muted} max-w-[640px] mx-auto`}>
            Segmiq holds the most valuable thing a service business owns: its pipeline. We treat it that way — with scoped access, a full audit trail, official channels, and data you can take with you at any time.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#contact" className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">
              Talk to us about security
            </a>
            <a href={ML.featuresSecurity} className={`px-6 py-3 ${m.ghostBtn}`}>
              Read the docs
            </a>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="pb-16">
        <div className="mx-auto max-w-[1100px] px-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRINCIPLES.map(({ Icon, t, d }) => (
            <div key={t} className={`${m.cardHover} p-6`}>
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
                <Icon className="w-[22px] h-[22px]" />
              </span>
              <div className="font-semibold">{t}</div>
              <p className={`mt-1.5 text-sm ${m.muted}`}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ACCESS (dark) */}
      <section className={`py-16 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#D4FF4F] text-black mb-4">
            <Key className="w-[22px] h-[22px]" />
          </span>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold leading-tight max-w-[620px]">
            Access is scoped, sign-in is controlled
          </h2>
          <p className={`mt-3 text-[15px] ${m.muted} max-w-[620px]`}>
            A salesperson can&apos;t see another client&apos;s pipeline. A client manager can&apos;t reach into the agency&apos;s books. Access follows the role, and authentication is handled the same way across every portal.
          </p>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {ACCESS.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.elevated} p-5`}>
                <span className="text-[#D4FF4F]">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="mt-3 font-medium">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA & INFRASTRUCTURE */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="max-w-[620px]">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
              <Server className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] font-extrabold leading-tight">Built on infrastructure you can trust</h2>
            <p className={`mt-3 text-[15px] ${m.muted}`}>
              We don&apos;t roll our own database or storage. Segmiq runs on managed, well-established providers, so your data sits behind the same protections used by thousands of production businesses.
            </p>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {DATA.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.cardHover} p-5`}>
                <span className={`grid place-items-center w-10 h-10 rounded-xl ${m.cardIcon} text-white mb-3`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="font-medium">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNICATIONS */}
      <section className={`py-16 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="max-w-[620px]">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
              <MessageCircle className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] font-extrabold leading-tight">Messaging through official channels only</h2>
            <p className={`mt-3 text-[15px] ${m.muted}`}>
              Some tools cut corners with unofficial WhatsApp gateways that get numbers banned. Segmiq doesn&apos;t. Every message goes through approved, sanctioned channels — protecting your business number and your sender reputation.
            </p>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {COMMS.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.card} p-5`}>
                <span className={`grid place-items-center w-10 h-10 rounded-xl ${m.cardIcon} text-white mb-3`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="font-medium">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA OWNERSHIP */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4">
              <Download className="w-[22px] h-[22px]" />
            </span>
            <h2 className="text-[28px] font-extrabold leading-tight">Your data stays yours</h2>
            <p className={`mt-3 text-[15px] ${m.muted}`}>
              A platform that holds your pipeline hostage isn&apos;t a partner. Segmiq is built around the opposite idea: the relationship belongs to your business, and you can take it with you.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {OWNERSHIP.map((o) => (
                <li key={o} className="flex gap-2">
                  <Check className="w-[18px] h-[18px] shrink-0 text-[#D4FF4F]" /> {o}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${m.elevated} p-6`}>
            <div className="text-[11px] tracking-widest text-[#D4FF4F] font-semibold">EXPORT PREVIEW</div>
            <div className="mt-3 rounded-lg bg-[#0C0C0C] p-4 font-mono text-[12px] text-white/80 leading-relaxed">
              segment: high_intent_unconverted
              <br />
              rows: 1,248
              <br />
              format: meta_csv
              <br />
              fields: name, phone, source, score, last_contact
              <br />
              <span className="text-[#D4FF4F]">status: ready to download</span>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4FF4F] text-black text-sm font-semibold">
              <Download className="w-4 h-4" /> Export segment
            </div>
          </div>
        </div>
      </section>

      {/* DISCLOSURE */}
      <section id="contact" className="py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className={`${m.panel} flex flex-col md:flex-row md:items-center justify-between gap-6`}>
            <div className="max-w-[560px]">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-3">
                <Shield className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-bold">Found something? Tell us.</h3>
              <p className={`mt-1.5 text-sm ${m.muted}`}>
                If you believe you&apos;ve found a security issue, we want to hear from you. Reach our team directly and we&apos;ll respond quickly.
              </p>
            </div>
            <a
              href="mailto:security@segmiq.com"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#0C0C0C] text-white font-semibold hover:opacity-90"
            >
              <Mail className="w-[18px] h-[18px]" /> security@segmiq.com
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-10 md:p-14 text-center">
            <h2 className="text-[32px] md:text-[40px] font-extrabold leading-[1.08] text-black max-w-[680px] mx-auto">
              Security questions before you switch?
            </h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">
              Bring them to the demo. We&apos;ll walk through exactly how your pipeline is stored, accessed, and protected.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href={ML.contact} className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">
                Book a demo
              </a>
              <a href={ML.featuresSecurity} className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5">
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
