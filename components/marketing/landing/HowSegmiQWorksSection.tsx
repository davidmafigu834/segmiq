import Image from "next/image";
import {
  ArrowRight,
  FileText,
  Handshake,
  Link2,
  MessageSquareText,
  UserRoundCheck,
} from "lucide-react";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

const STEPS: {
  title: string;
  description: string;
  Icon: typeof MessageSquareText;
  visual: {
    src: string;
    alt: string;
  };
}[] = [
  {
    title: "Enquiry arrives",
    description:
      "WhatsApp, ads, forms and field enquiries land in one conversation — ready for SegmiQ Agent or your team.",
    Icon: MessageSquareText,
    visual: {
      src: "/segmiq/visuals/workflow-enquiry.webp",
      alt: "New lead Tafadzwa Moyo captured from WhatsApp for a 5kW solar installation, score Hot 82.",
    },
  },
  {
    title: "Agent qualifies",
    description:
      "SegmiQ Agent asks the next question, writes the answers into the lead, and looks up real packages from the catalogue.",
    Icon: UserRoundCheck,
    visual: {
      src: "/segmiq/visuals/workflow-qualify.webp",
      alt: "Tafadzwa Moyo agent-qualified with lead score 86, budget, timeline and assigned to Tendai M.",
    },
  },
  {
    title: "Quotes & follows up",
    description:
      "It prepares a quotation, books a callback and sets the next follow-up — all attached to the same opportunity.",
    Icon: FileText,
    visual: {
      src: "/segmiq/visuals/workflow-quote.webp",
      alt: "SegmiQ Agent replied, booked a callback, prepared quote Q-2026-045 for $6,800, follow-up tomorrow 09:00.",
    },
  },
  {
    title: "Human takes over",
    description:
      "Discounts, complaints and judgement calls stop the Agent. Your team gets a briefing and closes the work.",
    Icon: Handshake,
    visual: {
      src: "/segmiq/visuals/workflow-handover.webp",
      alt: "Human needed for Chiedza Ndlovu after a discount request. Briefing: pricing is outside Agent authority.",
    },
  },
];

function StepVisual({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[12px]">
      <Image
        src={src}
        alt={alt}
        width={1024}
        height={1024}
        sizes="(min-width: 1280px) 260px, (min-width: 640px) 40vw, 88vw"
        className="h-auto w-full"
      />
    </div>
  );
}

export default function HowSegmiQWorksSection() {
  return (
    <section
      className="bg-[var(--marketing-bg-subtle)] marketing-halo marketing-halo--workflow"
      aria-labelledby="how-segmiq-works-heading"
    >
      <SegmiQSectionAtmosphere tone="workflow" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="segmiq-kicker text-[11px] text-[var(--marketing-olive)] sm:text-[12px]">
            How Agentic AI works
          </p>
          <h2
            id="how-segmiq-works-heading"
            className="mt-2.5 text-[32px] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[40px] lg:text-[46px]"
          >
            From first WhatsApp to a briefed human — one connected sale
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[14px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[15px]">
            SegmiQ Agent carries the routine work. Your team stays in control of the moments that
            need judgement, relationships and a signature.
          </p>
        </div>

        {/* Desktop / tablet workflow container */}
        <div className="mt-8 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] shadow-[var(--marketing-card-shadow)] sm:mt-9 sm:block segmiq-glass">
          <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={[
                  "relative p-5 xl:p-6",
                  index % 2 === 0 ? "md:border-r md:border-[var(--marketing-border-subtle)]" : "",
                  index < 2 ? "md:border-b md:border-[var(--marketing-border-subtle)] xl:border-b-0" : "",
                  index < STEPS.length - 1 ? "xl:border-r xl:border-[var(--marketing-border-subtle)]" : "",
                ].join(" ")}
              >
                {index < STEPS.length - 1 ? (
                  <span
                    className="pointer-events-none absolute right-0 top-8 z-10 hidden -translate-y-1/2 translate-x-1/2 text-[var(--marketing-text-muted)] xl:block"
                    aria-hidden
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)]">
                      <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </span>
                  </span>
                ) : null}

                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-brand)] text-[12px] font-bold text-[var(--marketing-brand-ink)]">
                    {index + 1}
                  </span>
                  <step.Icon
                    className="h-5 w-5 text-[var(--marketing-text-secondary)]"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                </div>

                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)] lg:text-[17px]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                  {step.description}
                </p>
                <StepVisual src={step.visual.src} alt={step.visual.alt} />
              </li>
            ))}
          </ol>
        </div>

        {/* Mobile vertical timeline */}
        <ol className="relative mt-10 space-y-0 sm:hidden">
          <span
            className="absolute bottom-4 left-[13px] top-4 w-px bg-[var(--marketing-border-strong)]"
            aria-hidden
          />
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-8 last:pb-0"
            >
              <span className="relative z-[1] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--marketing-brand)] text-[12px] font-bold text-[var(--marketing-brand-ink)]">
                {index + 1}
              </span>
              <div className="min-w-0 rounded-[14px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-4 shadow-[var(--marketing-card-shadow)] segmiq-glass">
                <div className="flex items-center gap-2">
                  <step.Icon
                    className="h-5 w-5 text-[var(--marketing-text-secondary)]"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                  {step.description}
                </p>
                <StepVisual src={step.visual.src} alt={step.visual.alt} />
              </div>
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-7 flex max-w-[560px] items-start justify-center gap-2 text-center text-[13px] leading-snug text-[var(--marketing-text-label)] sm:mt-8 sm:text-[14px]">
          <Link2
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-olive)]"
            strokeWidth={1.8}
            aria-hidden
          />
          <span>One customer. One history. Agent and team, connected.</span>
        </p>
      </div>
    </section>
  );
}
