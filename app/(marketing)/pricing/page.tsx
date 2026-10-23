import Link from "next/link";
import { Bot, Check, ChevronDown, MessageSquare, Users } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { m } from "@/components/marketing/marketingTheme";
import { ML } from "@/lib/marketing-links";
import { faqLd, pageMetadata, softwareAppLd } from "@/lib/seo";
import { CONVERSATION_DEFINITION } from "@/lib/commercial/catalogue";
import { loadCanonicalCatalogue } from "@/lib/commercial/catalogue-repository";
import { createPricingPresentation, formatUsd } from "@/lib/commercial/presentation";
import { PublicPricingCalculator } from "@/components/commercial/PublicPricingCalculator";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Segmiq CRM pricing from $19 per internal user per month, with optional Agentic AI packages.",
  path: "/pricing",
});

const FAQ = [
  ["How is Segmiq CRM priced?", "Starter is $19 and Growth is $29 per paid internal user each month. Owners, managers, and salespeople count once per person, even when they hold multiple roles."],
  ["How does Agentic AI pricing work?", "Agentic Business and Agentic Scale use Growth seats at $29 per user, plus an organisation fee of $99 or $249 per month."],
  ["Will Segmiq automatically charge for extra AI usage?", "No. A $25 top-up adds 250 customer AI conversations only after customer approval."],
  ["What is one customer AI conversation?", CONVERSATION_DEFINITION],
  ["Can I change plans later?", "Yes. Plan changes follow the applicable agreement and show the effective date and any approved adjustment before they are committed."],
] as const;

export default async function PricingPage() {
  const presentation = createPricingPresentation(await loadCanonicalCatalogue({ forNewOffer: true }));
  const faqItems = FAQ.map(([q, a]) => ({ q, a }));
  return (
    <>
      <JsonLd data={[softwareAppLd(), faqLd(faqItems)]} />
      <section className="pb-10 pt-20">
        <div className="mx-auto max-w-[780px] px-5 text-center">
          <div className={m.kicker}>PRICING</div>
          <h1 className="mt-3 text-[38px] font-extrabold leading-[1.06] tracking-tight sm:text-[50px]">CRM pricing that grows one seat at a time</h1>
          <p className={`mx-auto mt-5 max-w-[620px] text-[17px] ${m.muted}`}>Start with the CRM your team needs, then add customer-facing Agentic AI when the operation is ready.</p>
        </div>
      </section>

      <PublicPricingCalculator presentation={presentation} />

      <section className="pb-14">
        <div className="mx-auto grid max-w-[1180px] gap-5 px-5 sm:grid-cols-2 xl:grid-cols-4">
          {presentation.packages.map((pkg) => {
            const agentic = pkg.organisationFeeUsdCents > 0;
            return (
            <article key={pkg.id} className={`flex flex-col rounded-2xl p-6 ${agentic ? "bg-[#0C0C0C] text-white ring-1 ring-[#D4FF4F]" : m.pricingCard}`}>
              <p className={`text-[12px] font-semibold tracking-[0.14em] ${agentic ? "text-[#D4FF4F]" : m.pricingLabel}`}>{pkg.label.toUpperCase()}</p>
              <h2 className="mt-2 text-[22px] font-bold">{pkg.name}</h2>
              <p className={`mt-2 min-h-16 text-sm leading-5 ${agentic ? "text-white/65" : m.pricingSub}`}>{pkg.description}</p>
              <div className="mt-5 border-t border-current/10 pt-5">
                <p className="text-[34px] font-extrabold">{formatUsd(pkg.seatPriceUsdCents)}<span className={`text-[13px] font-medium ${agentic ? "text-white/55" : m.pricingSub}`}> / user / mo</span></p>
                <p className={`mt-1 min-h-5 text-[13px] ${agentic ? "text-[#D4FF4F]" : m.pricingSub}`}>
                  {agentic ? `+ ${formatUsd(pkg.organisationFeeUsdCents)} / organisation / mo` : "No organisation fee"}
                </p>
              </div>
              <ul className="mt-5 flex-1 space-y-3 text-sm">
                <li className="flex gap-2"><Users className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#D4FF4F]" />Paid internal users count once</li>
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#D4FF4F]" />{feature}</li>
                ))}
              </ul>
              <Link href={ML.contact} className={`mt-6 block min-h-11 rounded-full px-4 py-3 text-center text-sm font-semibold ${agentic ? "bg-[#D4FF4F] text-[#0C0C0C]" : m.pricingGhost}`}>Talk to sales</Link>
            </article>
          )})}
        </div>
      </section>

      <section className={`py-12 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[900px] px-5">
          <div className="grid gap-5 rounded-2xl border border-current/10 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 className="text-[22px] font-bold">Additional AI usage stays under your control</h2>
              <p className={`mt-2 text-sm leading-6 ${m.muted}`}>{presentation.topUpConversations} additional customer AI conversations cost {formatUsd(presentation.topUpPriceUsdCents)}. We require approval before purchase and never automatically charge for excess usage.</p>
              <p className={`mt-3 text-xs leading-5 ${m.faint}`}>{presentation.conversationDefinition}</p>
            </div>
            <div className="rounded-xl bg-[#D4FF4F] px-6 py-4 text-center text-[#0C0C0C]"><p className="text-[30px] font-extrabold">{formatUsd(presentation.topUpPriceUsdCents)}</p><p className="text-xs font-semibold">per approved {presentation.topUpConversations}</p></div>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-[760px] px-5">
          <h2 className="text-center text-[26px] font-extrabold">Pricing questions</h2>
          <div className={`mt-8 border-t ${m.border}`}>
            {FAQ.map(([q, a], index) => <details key={q} className={`group border-b py-4 ${m.border}`} open={index === 0}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden"><span>{q}</span><ChevronDown className={`h-[18px] w-[18px] shrink-0 transition-transform group-open:rotate-180 ${m.faint}`} /></summary>
              <p className={`pr-8 pt-2 text-sm leading-6 ${m.muted}`}>{a}</p>
            </details>)}
          </div>
        </div>
      </section>
    </>
  );
}
