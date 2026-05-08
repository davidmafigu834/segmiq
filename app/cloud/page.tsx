"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2,
  LayoutGrid,
  CloudUpload,
  ArrowRight,
  Menu,
  X,
  Check,
} from "lucide-react";

const INDUSTRIES = [
  "Construction",
  "Solar Installation",
  "Landscaping",
  "Electrical",
  "Plumbing",
  "Interior Design",
  "Roofing",
  "Fencing",
  "Events",
  "Architecture",
  "and more",
];

const FEATURES = [
  {
    icon: CloudUpload,
    title: "Upload from anywhere",
    body: "Open the app on your phone, pick photos straight from your gallery or camera, and they're instantly organised by project. No cables, no transfers, no fuss.",
  },
  {
    icon: Share2,
    title: "Share with one link",
    body: "Every project gets a professional share link. Send it to a client, a prospect, or your team. They see a beautiful gallery — no login required.",
  },
  {
    icon: LayoutGrid,
    title: "Build your portfolio",
    body: "Featured projects appear on your public profile page automatically. The more you upload, the stronger your portfolio. Let your work speak for itself.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create a project",
    body: "Give it a name, category, and location. Takes 30 seconds.",
  },
  {
    n: "02",
    title: "Upload your photos",
    body: "From your phone gallery or camera, directly from the job site.",
  },
  {
    n: "03",
    title: "Share instantly",
    body: "Copy a link and send it to your client. They see everything, professionally presented.",
  },
  {
    n: "04",
    title: "Win more business",
    body: "Your portfolio page updates automatically. Prospects see your best work before they even call.",
  },
];

export default function CloudLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#D4FF4F]">
              <CloudUpload className="h-4 w-4 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">Leadstaq Cloud</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/cloud/login"
              className="rounded-lg px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/cloud/signup"
              className="rounded-lg bg-[#D4FF4F] px-5 py-2 text-sm font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white/70 hover:text-white"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 px-6 py-4 flex flex-col gap-3 md:hidden">
            <Link
              href="/cloud/login"
              className="rounded-lg border border-white/20 py-3 text-center text-sm font-medium text-white"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/cloud/signup"
              className="rounded-lg bg-[#D4FF4F] py-3 text-center text-sm font-semibold text-black"
              onClick={() => setMenuOpen(false)}
            >
              Get started free
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-[calc(100vh-65px)] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(212,255,79,0.08),transparent)]" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4FF4F]" />
            For project-based businesses
          </div>

          <h1 className="font-serif text-5xl font-normal leading-[1.05] text-white md:text-7xl">
            Every project,
            <br />
            <em>beautifully documented.</em>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-white/55 md:text-lg">
            Upload photos from the field. Share professional project galleries with clients.
            Build a portfolio that wins new business.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/cloud/signup"
              className="flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-8 py-3.5 text-sm font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 rounded-xl border border-white/20 px-8 py-3.5 text-sm font-semibold text-white hover:border-white/40 transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 text-xs text-white/30">
            Used by construction, solar, landscaping &amp; electrical teams
          </p>

          {/* Hero mockup */}
          <div className="relative mx-auto mt-16 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              <span className="ml-3 text-[10px] text-white/30">leadstaq.cloud — Your Projects</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {[
                "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
                "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80",
                "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&q=80",
                "https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&q=80",
                "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400&q=80",
              ].map((src, i) => (
                <div key={i} className="aspect-[4/3] overflow-hidden rounded-lg bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover opacity-80" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#D4FF4F]">
            Built for field work
          </p>
          <h2 className="mb-16 text-center text-3xl font-light text-white md:text-4xl">
            Everything you need, nothing you don&apos;t
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-[#111111] p-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4FF4F]/10">
                  <f.icon className="h-5 w-5 text-[#D4FF4F]" />
                </div>
                <h3 className="mb-3 text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#D4FF4F]">
            Simple process
          </p>
          <h2 className="mb-16 text-center text-3xl font-light text-white md:text-4xl">
            From job site to portfolio in minutes
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative rounded-2xl border border-white/10 bg-[#111111] p-6">
                <div className="mb-4 font-mono text-4xl font-bold text-white/10">{s.n}</div>
                {i < STEPS.length - 1 && (
                  <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 lg:block">
                    <ArrowRight className="h-4 w-4 text-white/20" />
                  </div>
                )}
                <h3 className="mb-2 text-base font-semibold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="border-t border-white/10 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            Industries we serve
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {INDUSTRIES.map((ind) => (
              <span
                key={ind}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#D4FF4F]">
            Trusted by contractors
          </p>
          <h2 className="mb-16 text-center text-3xl font-light text-white md:text-4xl">
            Real results from real teams
          </h2>

          <div className="mx-auto mb-16 max-w-2xl rounded-2xl border border-white/10 bg-[#111111] p-8 text-center">
            <p className="mb-6 text-xl font-light italic leading-relaxed text-white/80">
              &ldquo;Since using Leadstaq Cloud, I&apos;ve closed two deals just by sending a portfolio link.
              Clients actually call me back now.&rdquo;
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D4FF4F] text-sm font-bold text-black">
                J
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Jason M.</p>
                <p className="text-xs text-white/40">Solar Installation, Cape Town</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 text-center sm:grid-cols-3">
            {([
              { value: "2,400+", label: "Projects documented" },
              { value: "38,000+", label: "Photos uploaded" },
              { value: "180+", label: "Contractors trust Leadstaq" },
            ] as { value: string; label: string }[]).map(({ value, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-[#111111] p-6">
                <div className="mb-1 text-3xl font-semibold text-white">{value}</div>
                <div className="text-sm text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#D4FF4F]">
            Pricing
          </p>
          <h2 className="mb-4 text-center text-3xl font-light text-white md:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mb-16 text-center text-base text-white/40">No free tier. No hidden fees. Pay for what you use, cancel any time.</p>

          {(() => {
            const pricingPlans = [
              {
                name: "Starter", price: "$20", period: "per month", storage: "20 GB",
                team: "Up to 3 members",
                features: ["Unlimited projects", "Public share links", "Basic watermarking", "Public profile page", "Mobile PWA app"],
                cta: "Get started", highlight: false, note: null,
              },
              {
                name: "Professional", price: "$49", period: "per month", storage: "100 GB",
                team: "Up to 10 members",
                features: ["Everything in Starter", "Custom logo watermark", "Project analytics", "AI photo enhancement", "Priority support"],
                cta: "Get started", highlight: true, note: "Most popular",
              },
              {
                name: "Business", price: "$99", period: "per month", storage: "500 GB",
                team: "Unlimited members",
                features: ["Everything in Professional", "Custom domain", "Video URL embeds", "Testimonials manager", "CSV data export", "Dedicated onboarding"],
                cta: "Get started", highlight: false, note: null,
              },
            ];
            return (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", maxWidth: 1100, margin: "0 auto" }}>
                {pricingPlans.map((plan) => (
                  <div
                    key={plan.name}
                    style={{
                      background: plan.highlight ? "#1C1410" : "#FFFFFF",
                      border: plan.highlight ? "0.5px solid rgba(212,255,79,0.2)" : "0.5px solid rgba(28,20,16,0.08)",
                      borderRadius: 20, padding: "28px 24px", position: "relative",
                      flex: "1 1 280px", maxWidth: 340,
                    }}
                  >
                    {plan.note && (
                      <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#D4FF4F", color: "#1C1410", fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>
                        {plan.note}
                      </span>
                    )}
                    <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: plan.highlight ? "rgba(255,255,255,0.5)" : "#8C7B6B", margin: "0 0 8px" }}>
                      {plan.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "0 0 4px" }}>
                      <span style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 44, color: plan.highlight ? "#FFFFFF" : "#1C1410", lineHeight: 1 }}>
                        {plan.price}
                      </span>
                      <span style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.4)" : "#8C7B6B" }}>
                        {plan.period}
                      </span>
                    </div>
                    <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.5)" : "#8C7B6B", margin: "0 0 20px" }}>
                      {plan.storage} storage · {plan.team}
                    </p>
                    <div style={{ height: "0.5px", background: plan.highlight ? "rgba(255,255,255,0.08)" : "rgba(28,20,16,0.07)", margin: "0 0 20px" }} />
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                      {plan.features.map((feature) => (
                        <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.75)" : "#4A3828" }}>
                          <Check style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1, color: plan.highlight ? "#D4FF4F" : "#2E7D5E" }} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/cloud/signup"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, background: plan.highlight ? "#D4FF4F" : "#1C1410", color: plan.highlight ? "#1C1410" : "#D4FF4F", fontSize: 13, fontWeight: 700, fontFamily: "var(--fw-font-body), system-ui, sans-serif", textDecoration: "none" }}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-light text-white md:text-4xl">
            Start documenting your work today.
          </h2>
          <p className="mb-10 text-base text-white/50">Free to get started. No credit card required.</p>
          <Link
            href="/cloud/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-10 py-4 text-base font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
          >
            Create your free account
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/30">
            {["No credit card required", "Free to start", "Cancel anytime"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#D4FF4F]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#D4FF4F]">
              <CloudUpload className="h-3 w-3 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-sm text-white/50">Leadstaq Cloud · © 2026 Leadstaq</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/legal/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-white/70 transition-colors">Terms</Link>
            <a href="https://leadstaq.tech" className="hover:text-white/70 transition-colors">
              leadstaq.tech
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
