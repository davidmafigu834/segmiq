import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, MapPin, MessageCircle, ShieldAlert } from "lucide-react";
import { ML } from "@/lib/marketing-links";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

const BEATS = [
  {
    n: "01",
    title: "Teach it",
    body: "How you sell, where you serve, how you sound, what you never promise. Playbooks, FAQs, approved documents, rules.",
  },
  {
    n: "02",
    title: "It looks it up",
    body: "On every enquiry the Agent retrieves approved facts and the live catalogue. Missing facts stay missing. It does not fill gaps from the internet.",
  },
  {
    n: "03",
    title: "It stops",
    body: "Discounts, coverage you don’t have, anything unsure — it escalates and briefs a person. That is the system working.",
  },
] as const;

/** Even hexagon around the core. Angles: 0° east, y grows down. */
const NODES = [
  { label: "Service areas", hint: "Won’t guess coverage", deg: -90 },
  { label: "Playbooks", hint: "How to qualify", deg: -30 },
  { label: "Catalogue", hint: "Real prices only", deg: 30 },
  { label: "FAQs", hint: "Approved answers", deg: 90 },
  { label: "Voice", hint: "How you sound", deg: 150 },
  { label: "Escalation", hint: "When to stop", deg: 210 },
] as const;

const CARD_RING = 42;
const SPHERE_RING = 25.5;

function polar(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: 50 + Math.cos(rad) * radius,
    y: 50 + Math.sin(rad) * radius,
  };
}

const PILLARS = [
  {
    title: "Who you are",
    body: "Business profile, brand voice, ideal customers. The Agent introduces itself as your company — not as a generic assistant.",
    Icon: MessageCircle,
  },
  {
    title: "What you sell, where",
    body: "Catalogue and payment terms stay in the CRM. Company Brain adds service areas and pricing guidance so it never invents coverage or a number.",
    Icon: MapPin,
  },
  {
    title: "How you qualify",
    body: "Playbooks, sales-stage guidance and response examples. It asks the next question your team would ask — then writes the answer into the lead.",
    Icon: BookOpen,
  },
  {
    title: "When a human is required",
    body: "Agent rules, escalation, support routing. Pricing disputes and complaints are not “handled”. They are handed over.",
    Icon: ShieldAlert,
  },
] as const;

export default function CompanyBrainSection() {
  return (
    <section
      id="company-brain"
      className="scroll-mt-[72px] marketing-halo marketing-halo--brain bg-[var(--marketing-bg)]"
      aria-labelledby="company-brain-heading"
    >
      <SegmiQSectionAtmosphere tone="brain" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[80px] lg:pt-16">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
          <div className="min-w-0 text-center lg:text-left">
            <p className="segmiq-kicker text-[11px] text-[var(--marketing-olive)] sm:text-[12px]">
              Company Brain
            </p>
            <h2
              id="company-brain-heading"
              className="mx-auto mt-2.5 max-w-[16ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:mx-0 lg:text-[46px]"
            >
              Generic AI guesses.{" "}
              <span className="lime">Yours looks it up.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[34rem] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[16px] lg:mx-0">
              Company Brain is the operating context SegmiQ Agent is allowed to use. You teach it
              how this company sells, serves and decides. It retrieves approved facts. It never
              invents a price, a suburb, or a promise.
            </p>
          </div>

          <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-2.5">
            {BEATS.map((beat) => (
              <li
                key={beat.n}
                className="segmiq-glass flex gap-3 rounded-[14px] border border-[var(--marketing-border)] p-4 sm:flex-col sm:items-center sm:gap-2 sm:text-center lg:flex-row lg:items-start lg:gap-3 lg:text-left"
              >
                <span className="text-[11px] font-semibold tabular-nums tracking-[0.08em] text-[var(--marketing-olive)]">
                  {beat.n}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                    {beat.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-[1.5] text-[var(--marketing-text-secondary)]">
                    {beat.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="segmiq-brain-stage relative mx-auto mt-10 aspect-square w-full max-w-[760px] sm:mt-14 lg:mt-16">
          <svg
            className="pointer-events-none absolute inset-0 z-[1]"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden
          >
            {NODES.map((node) => {
              const from = polar(node.deg, CARD_RING - 8.5);
              const to = polar(node.deg, SPHERE_RING);
              return (
                <g key={node.label}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="rgba(212,255,79,0.55)"
                    strokeWidth="0.35"
                  />
                  <circle cx={to.x} cy={to.y} r="0.85" fill="#D4FF4F" />
                  <circle
                    cx={to.x}
                    cy={to.y}
                    r="1.7"
                    stroke="rgba(212,255,79,0.35)"
                    strokeWidth="0.25"
                  />
                </g>
              );
            })}
          </svg>

          <div className="absolute left-1/2 top-1/2 z-0 w-[48%] -translate-x-1/2 -translate-y-1/2 sm:w-[54%]">
            <Image
              src="/segmiq/visuals/company-brain-core-cutout.webp"
              alt="SegmiQ Company Brain — a glass neural core with a Q at the centre"
              width={1024}
              height={1024}
              sizes="(min-width: 1024px) 410px, 54vw"
              className="h-auto w-full"
              priority={false}
            />
          </div>

          {NODES.map((node) => {
            const pos = polar(node.deg, CARD_RING);
            return (
              <div
                key={node.label}
                className="segmiq-glass absolute z-[2] w-[100px] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[var(--marketing-border)] px-2 py-1.5 sm:w-[138px] sm:rounded-[12px] sm:px-3 sm:py-2.5"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <p className="text-[11px] font-semibold leading-tight text-[var(--marketing-text)] sm:text-[12px]">
                  {node.label}
                </p>
                <p className="mt-0.5 text-[9px] leading-snug text-[var(--marketing-text-muted)] sm:text-[10px]">
                  {node.hint}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)] lg:items-stretch">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {PILLARS.map((item) => (
              <li
                key={item.title}
                className="segmiq-glass rounded-[16px] border border-[var(--marketing-border)] p-5"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[rgba(180,220,60,0.22)] bg-[rgba(212,255,79,0.14)] text-[#536600] dark:border-[rgba(212,255,79,0.12)] dark:bg-[rgba(212,255,79,0.10)] dark:text-[#D4FF4F]">
                  <item.Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                </span>
                <h3 className="mt-3.5 text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>

          <div className="marketing-product-chrome overflow-hidden rounded-[16px] shadow-[0_18px_45px_rgba(16,24,40,0.08)]">
            <Image
              src="/segmiq/visuals/company-brain-readiness.webp"
              alt="Company Brain for Adlense Solar — Business Profile, What We Sell, playbooks, Service Areas, FAQs and Escalation marked ready."
              width={682}
              height={1024}
              sizes="(min-width: 1024px) 380px, 92vw"
              className="h-auto w-full"
            />
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-[560px] text-center text-[13px] leading-snug text-[var(--marketing-text-label)] sm:mt-10 sm:text-[14px]">
          Catalogue, hours and payment terms stay in SegmiQ records. Company Brain is the layer on
          top — so the Agent sells like your company, not like a model.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href={ML.contact}
            className="segmiq-btn-primary inline-flex h-11 items-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] px-5 text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)]"
          >
            See Company Brain on a demo
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
