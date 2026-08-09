import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Globe2,
  HardHat,
  House,
  MapPinned,
  MessageCircle,
  Smartphone,
  Sprout,
  Sun,
  WalletCards,
  Zap,
} from "lucide-react";
import { ML } from "@/lib/marketing-links";

const industries = [
  {
    name: "Solar",
    icon: Sun,
    image:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=82&w=900&auto=format&fit=crop",
  },
  {
    name: "Construction",
    icon: HardHat,
    image:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=82&w=900&auto=format&fit=crop",
  },
  {
    name: "Roofing",
    icon: House,
    image:
      "https://images.unsplash.com/photo-1632759145351-1d592919f522?q=82&w=900&auto=format&fit=crop",
  },
  {
    name: "Electrical",
    icon: Zap,
    image:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?q=82&w=900&auto=format&fit=crop",
  },
  {
    name: "Landscaping",
    icon: Sprout,
    image:
      "https://images.unsplash.com/photo-1558904541-efa843a96f01?q=82&w=900&auto=format&fit=crop",
  },
  {
    name: "Real Estate",
    icon: Building2,
    image:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=82&w=900&auto=format&fit=crop",
  },
] as const;

const reasons = [
  [MessageCircle, "WhatsApp-first sales workflows"],
  [Globe2, "Native Facebook Lead Ads capture"],
  [Building2, "Full company ownership of lead history"],
  [WalletCards, "Manual billing support for bank transfer, mobile money and cash"],
  [Smartphone, "Salesperson workflows designed for mobile devices"],
  [MapPinned, "Multi-location and agency-ready structure"],
  [HardHat, "Vertical workflows for service and trade businesses"],
] as const;

const plans = [
  {
    name: "Starter",
    price: "$99",
    description: "Up to 5 salespeople",
    features: [
      "WhatsApp lead capture",
      "Rules-based lead scoring",
      "Lead assignment and routing",
      "Lead timeline",
      "One-tap send tools",
      "Quotations",
    ],
    button: "Start with Starter",
  },
  {
    name: "Growth",
    price: "$199",
    description: "Up to 15 salespeople",
    features: [
      "Everything in Starter",
      "AI intent scoring",
      "Daily sales coaching",
      "Win analysis",
      "Stale-lead recovery",
      "Advanced insights",
    ],
    button: "Choose Growth",
    featured: true,
  },
  {
    name: "Scale",
    price: "$349",
    description: "Unlimited salespeople",
    features: [
      "Everything in Growth",
      "Full intelligence engine",
      "Audience segments",
      "CSV export",
      "Priority support",
    ],
    button: "Talk to sales",
  },
] as const;

export default function LandingSections() {
  return (
    <>
      <section id="solutions" className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4ff4f]">
                Industry-ready
              </span>
              <h2 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[44px]">
                Built for African service industries
              </h2>
            </div>
            <p className="max-w-[610px] text-sm leading-7 text-white/50 sm:text-base">
              SegmiQ follows the sales process your business already uses instead of forcing your
              team into a generic foreign CRM workflow.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {industries.map(({ name, icon: Icon, image }, index) => (
              <article
                key={name}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 ${
                  index === 0 || index === 5 ? "min-h-[280px] lg:col-span-2" : "min-h-[240px]"
                }`}
              >
                <Image
                  src={image}
                  alt={`${name} service business`}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes={
                    index === 0 || index === 5
                      ? "(max-width: 1023px) 100vw, 66vw"
                      : "(max-width: 1023px) 50vw, 33vw"
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#d4ff4f]/25 bg-black/55 text-[#d4ff4f] backdrop-blur">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  <h3 className="text-sm font-semibold">{name}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111310] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4ff4f]">
              Why SegmiQ
            </span>
            <h2 className="mt-4 max-w-[500px] text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[48px]">
              Built around how African service businesses actually sell
            </h2>
            <p className="mt-6 max-w-[470px] text-sm leading-7 text-white/45">
              The structure, communication channels and payment realities your team already works
              with — designed into the CRM from the start.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {reasons.map(([Icon, reason], index) => (
              <li
                key={reason}
                className={`flex min-h-[96px] items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 ${
                  index === reasons.length - 1 ? "sm:col-span-2" : ""
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#d4ff4f]/10 text-[#d4ff4f]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="pt-1 text-[12px] leading-5 text-white/70">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <div className="text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4ff4f]">
              SegmiQ CRM pricing
            </span>
            <h2 className="mt-4 text-[32px] font-semibold tracking-[-0.03em] sm:text-[44px]">
              Simple pricing for growing sales teams
            </h2>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:items-start">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-2xl border p-6 sm:p-7 ${
                  plan.featured
                    ? "border-[#d4ff4f]/70 bg-[#151a0d] shadow-[0_24px_70px_rgba(0,0,0,0.4)] lg:-mt-3 lg:pb-10"
                    : "border-white/10 bg-[#151714]"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#d4ff4f] px-3 py-1 text-[9px] font-bold text-black">
                    Most popular
                  </span>
                )}
                <h3 className="text-sm font-semibold">{plan.name}</h3>
                <div className="mt-4 text-[42px] font-semibold leading-none tracking-[-0.04em]">
                  {plan.price}
                  <span className="text-xs font-normal tracking-normal text-white/40">/month</span>
                </div>
                <p className="mt-2 text-[11px] text-white/40">{plan.description}</p>
                <div className="my-6 h-px bg-white/10" />
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-[11px] text-white/65">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#d4ff4f]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={ML.contact}
                  className={`mt-8 flex h-11 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    plan.featured
                      ? "bg-[#d4ff4f] text-black hover:bg-[#e2ff79]"
                      : "border border-white/15 text-white hover:bg-white/5"
                  }`}
                >
                  {plan.button}
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-7 text-center text-[11px] text-white/40">
            Managers and agency administrators are not counted against salesperson limits.
          </p>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="relative mx-auto min-h-[430px] max-w-[1120px] overflow-hidden rounded-[24px] border border-white/10">
          {/* Temporary commissioned landing artwork; replace with an approved SegmiQ customer shoot. */}
          <Image
            src="/marketing/segmiq-landing-cta.png"
            alt="African solar business owner with his team and service vehicles"
            fill
            className="object-cover object-[65%_center]"
            sizes="(max-width: 1120px) 100vw, 1120px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
          <div className="relative flex min-h-[430px] max-w-[590px] flex-col justify-center p-6 sm:p-12 lg:p-16">
            <h2 className="text-[36px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[54px]">
              Stop losing leads across phones and chats.
            </h2>
            <p className="mt-5 max-w-[500px] text-sm leading-6 text-white/60 sm:text-base">
              Run your sales team on one platform built for how African service businesses actually
              win work.
            </p>
            <div className="mt-7 flex flex-col items-start gap-4 min-[420px]:flex-row min-[420px]:items-center">
              <Link
                href={ML.contact}
                className="group inline-flex h-12 items-center gap-2 rounded-lg bg-[#d4ff4f] px-5 text-sm font-semibold text-black transition hover:bg-[#e2ff79]"
              >
                Book a SegmiQ demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href={ML.contact} className="text-sm font-medium text-white/70 hover:text-white">
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
