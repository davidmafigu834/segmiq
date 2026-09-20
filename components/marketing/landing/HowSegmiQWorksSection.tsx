import Image from "next/image";

const STEPS = [
  {
    title: "Enquiry arrives",
    description:
      "WhatsApp, ads, forms and field enquiries land in one conversation, ready for SegmiQ Agent or your team.",
    visual: {
      src: "/segmiq/visuals/workflow-enquiry.webp",
      alt: "New lead Tafadzwa Moyo captured from WhatsApp for a 5kW solar installation, score Hot 82.",
    },
  },
  {
    title: "Agent qualifies",
    description:
      "SegmiQ Agent asks the next question, writes the answers into the lead, and looks up real packages from the catalogue.",
    visual: {
      src: "/segmiq/visuals/workflow-qualify.webp",
      alt: "Tafadzwa Moyo agent-qualified with lead score 86, budget, timeline and assigned to Tendai M.",
    },
  },
  {
    title: "Quotes and follows up",
    description:
      "It prepares a quotation, books a callback and sets the next follow-up, all attached to the same opportunity.",
    visual: {
      src: "/segmiq/visuals/workflow-quote.webp",
      alt: "SegmiQ Agent replied, booked a callback, prepared quote Q-2026-045 for $6,800, follow-up tomorrow 09:00.",
    },
  },
  {
    title: "Human takes over",
    description:
      "Discounts, complaints and judgement calls stop the Agent. Your team gets a briefing and closes the work.",
    visual: {
      src: "/segmiq/visuals/workflow-handover.webp",
      alt: "Human needed for Chiedza Ndlovu after a discount request. Briefing: pricing is outside Agent authority.",
    },
  },
] as const;

export default function HowSegmiQWorksSection() {
  return (
    <section className="bg-[var(--marketing-bg)]" aria-labelledby="how-segmiq-works-heading">
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 lg:pb-24">
        <h2
          id="how-segmiq-works-heading"
          className="max-w-[20ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[44px]"
        >
          From first WhatsApp to a briefed human
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)]">
          SegmiQ Agent carries the routine work. Your team stays in control of the moments that need
          judgement, relationships and a signature.
        </p>

        <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {STEPS.map((step) => (
            <li key={step.title} className="min-w-0">
              <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                {step.description}
              </p>
              <figure className="segmiq-figure mt-4">
                <Image
                  src={step.visual.src}
                  alt={step.visual.alt}
                  width={1024}
                  height={1024}
                  sizes="(min-width: 1280px) 260px, (min-width: 640px) 40vw, 88vw"
                  className="h-auto w-full"
                />
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
