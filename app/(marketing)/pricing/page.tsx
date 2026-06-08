/**
 * Pricing — page body. Header/footer come from app/(marketing)/layout.tsx.
 * Route: /pricing
 * Server component. FAQ uses native <details> (no client JS needed).
 */

import Link from "next/link";
import { Check, Minus, ChevronDown, ArrowRight } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { faqLd, pageMetadata, softwareAppLd } from "@/lib/seo";
import { m } from "@/components/marketing/marketingTheme";
import { ML } from "@/lib/marketing-links";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Segmiq CRM pricing — per client company, billed monthly. Starter $99, Growth $199, Scale $349.",
  path: "/pricing",
});

const PLANS = [
  { name: "Starter", price: "$99", seats: "Up to 5 salespeople", popular: false,
    feats: ["All three portals", "WhatsApp lead capture & confirmations", "Conversational lead form", "One-tap send panel", "Complete lead timeline & handover", "Rules-based lead scoring"] },
  { name: "Growth", price: "$199", seats: "Up to 15 salespeople", popular: true,
    feats: ["Everything in Starter", "AI intent scoring (0–100)", "Daily AI coaching on WhatsApp", "Win analysis & pattern insights", "Stale lead detection & recovery", "Onboarding coaching (day 1/3/7)"] },
  { name: "Scale", price: "$349", seats: "Unlimited salespeople", popular: false,
    feats: ["Everything in Growth", "Full intelligence engine", "Audience segments + CSV export", "Performance recommendations", "Weekly AI insights", "Priority support"] },
];

// each cell: "check" | "dash" | string
const ROWS: [string, string, string, string][] = [
  ["Salespeople", "5", "15", "Unlimited"],
  ["Agency, manager & rep portals", "check", "check", "check"],
  ["WhatsApp lead capture & confirmations", "check", "check", "check"],
  ["Conversational lead form", "check", "check", "check"],
  ["One-tap send panel", "check", "check", "check"],
  ["Lead timeline & handover notes", "check", "check", "check"],
  ["Lead scoring", "Rules-based", "+ AI intent", "+ AI intent"],
  ["Daily AI coaching", "dash", "check", "check"],
  ["Win analysis & insights", "dash", "check", "check"],
  ["Stale lead recovery", "dash", "check", "check"],
  ["Onboarding coaching", "dash", "check", "check"],
  ["Full intelligence engine", "dash", "dash", "check"],
  ["Audience segments + CSV export", "dash", "dash", "check"],
  ["Performance recommendations", "dash", "dash", "check"],
  ["Weekly AI insights", "dash", "dash", "check"],
];

const FAQ = [
  ["Is Segmiq CRM priced per user or per company?", "Per client company, billed monthly. Each plan includes a number of salesperson seats — 5 on Starter, 15 on Growth, unlimited on Scale."],
  ["What counts as a salesperson?", "An active rep with their own login to the salesperson portal. Managers and the agency admin are not counted against the salesperson limit."],
  ["Can I change plans later?", "Yes. You can upgrade or downgrade at any time as your team and lead volume change."],
  ["Do I need Segmiq Cloud as well?", "No — they are separate products. Segmiq CRM manages leads and sales; Segmiq Cloud documents projects and builds your public portfolio. They share one login and database and work well together, but each is billed on its own plan."],
  ["Is lead scoring only on the AI plans?", "No. Scoring runs on every plan. Starter uses a deterministic, rules-based engine (recency, budget, urgency, completeness, campaign fit). Growth and Scale add an AI intent score on top."],
  ["How do I get started?", "Book a demo. We will set up a portal, load a sample of your real leads, and walk you through the plan that fits before you commit."],
];

function Cell({ v }: { v: string }) {
  if (v === "check") return <Check className="w-[18px] h-[18px] text-[#D4FF4F] mx-auto" />;
  if (v === "dash") return <Minus className={`w-4 h-4 ${m.faint} mx-auto`} />;
  return <span>{v}</span>;
}

export default function PricingPage() {
  const faqItems = FAQ.map(([q, a]) => ({ q, a }));
  return (
    <>
      <JsonLd data={[softwareAppLd(), faqLd(faqItems)]} />
      {/* HERO */}
      <section className="pt-20 pb-10">
        <div className="mx-auto max-w-[760px] px-5 text-center">
          <div className={m.kicker}>PRICING</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">Pricing that scales with your team</h1>
          <p className={`mt-5 text-[17px] ${m.muted} max-w-[600px] mx-auto`}>Segmiq CRM is priced per client company, billed monthly. Every plan includes all three portals — bigger plans add the AI and intelligence layer.</p>
        </div>
      </section>

      {/* PLANS */}
      <section className="pb-8">
        <div className="mx-auto max-w-[1100px] px-5 grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <div key={p.name} className={`rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 ${p.popular ? "bg-[#0C0C0C] text-white ring-2 ring-[#D4FF4F]" : m.pricingCard}`}>
              <div className="flex items-center justify-between">
                <div className={`text-[13px] font-semibold tracking-wide ${p.popular ? "text-[#D4FF4F]" : m.pricingLabel}`}>{p.name.toUpperCase()}</div>
                {p.popular && <span className="text-[11px] bg-[#D4FF4F] text-black px-2 py-0.5 rounded-full font-semibold">Most popular</span>}
              </div>
              <div className="mt-2 text-[40px] font-extrabold">{p.price}<span className={`text-[15px] font-medium ${p.popular ? "text-white/60" : m.pricingSub}`}>/mo</span></div>
              <div className={`text-sm ${p.popular ? "text-white/60" : m.pricingSub}`}>{p.seats} · per client company</div>
              <ul className="mt-5 space-y-2 text-sm">
                {p.feats.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="w-[18px] h-[18px] shrink-0 text-[#D4FF4F]" /> {f}</li>
                ))}
              </ul>
              <Link href={ML.contact} className={`block text-center mt-6 px-4 py-2.5 rounded-full font-semibold ${p.popular ? "bg-[#D4FF4F] text-black hover:bg-[#c8f040]" : m.pricingGhost}`}>Choose {p.name}</Link>
            </div>
          ))}
        </div>
        <div className={`mx-auto max-w-[1100px] px-5 mt-4 text-center text-[13px] ${m.faint}`}>Lead scoring works on every plan. Starter uses a rules-based engine; Growth and Scale add AI intent scoring.</div>
      </section>

      {/* COMPARISON */}
      <section className="py-14">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">Compare plans</h2>
          <div className={`mt-8 ${m.tableWrap}`}>
            <table className="w-full min-w-[640px] text-sm border-collapse">
              <thead>
                <tr className={m.tableHead}>
                  <th className="p-4 font-semibold w-[40%]">Feature</th>
                  <th className="p-4 font-semibold text-center">Starter</th>
                  <th className="p-4 font-semibold text-center bg-[#181818] text-white">Growth</th>
                  <th className="p-4 font-semibold text-center">Scale</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r[0]} className={`border-t ${m.border} ${i % 2 ? m.tableRowAlt : ""}`}>
                    <td className={`p-4 ${m.muted}`}>{r[0]}</td>
                    <td className="p-4 text-center font-medium"><Cell v={r[1]} /></td>
                    <td className={`p-4 text-center font-medium ${m.tableRowAlt}`}><Cell v={r[2]} /></td>
                    <td className="p-4 text-center font-medium"><Cell v={r[3]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CLOUD CALLOUT */}
      <section className={`py-12 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-[560px]">
            <div className={`${m.kicker} text-[#D4FF4F]`}>SEGMIQ CLOUD</div>
            <h2 className="text-[26px] sm:text-[30px] font-extrabold leading-tight mt-2">Need the portfolio platform too?</h2>
            <p className={`mt-3 text-[15px] ${m.muted}`}>Segmiq Cloud — project documentation, public profiles, and lead capture — is a separate product with its own plans. It shares your login and database, and bills separately.</p>
            <a href="https://cloud.segmiq.com" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">See Cloud pricing <ArrowRight className="w-4 h-4" /></a>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-[420px]">
            <div className={`${m.elevated} p-4 text-center`}><div className={`text-xs ${m.faint}`}>Starter</div><div className="text-[22px] font-extrabold mt-1">$20</div><div className={`text-[11px] ${m.faint}`}>/mo</div></div>
            <div className="rounded-xl bg-[#D4FF4F] text-black p-4 text-center"><div className="text-xs opacity-70">Professional</div><div className="text-[22px] font-extrabold mt-1">$49</div><div className="text-[11px] opacity-60">/mo</div></div>
            <div className={`${m.elevated} p-4 text-center`}><div className={`text-xs ${m.faint}`}>Business</div><div className="text-[22px] font-extrabold mt-1">$99</div><div className={`text-[11px] ${m.faint}`}>/mo</div></div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14">
        <div className="mx-auto max-w-[760px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">Pricing questions</h2>
          <div className={`mt-8 border-t ${m.border}`}>
            {FAQ.map(([q, a], i) => (
              <details key={q} className={`group border-b ${m.border} py-4`} open={i === 0}>
                <summary className="flex items-center justify-between text-[15px] font-medium cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span>{q}</span>
                  <ChevronDown className={`w-[18px] h-[18px] ${m.faint} transition-transform duration-200 group-open:rotate-180`} />
                </summary>
                <p className={`mt-2 text-sm ${m.muted} pr-8`}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-10 md:p-14 text-center">
            <h2 className="text-[32px] md:text-[40px] font-extrabold leading-[1.08] text-black max-w-[680px] mx-auto">Not sure which plan fits?</h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">Book a demo. We&apos;ll look at your team size and lead volume and point you to the right plan — no pressure.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href={ML.contact} className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">Book a demo</a>
              <a href={ML.contact} className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5">Contact sales</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
