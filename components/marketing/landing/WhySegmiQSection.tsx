import Image from "next/image";

const REASONS = [
  {
    title: "One place for every enquiry",
    description:
      "Capture WhatsApp, Facebook, website, referral and field enquiries in one organised sales system.",
  },
  {
    title: "Agentic AI on WhatsApp",
    description:
      "SegmiQ Agent answers, qualifies and follows up so the first response is not waiting on someone to pick up the phone.",
  },
  {
    title: "Company Brain, not guesswork",
    description:
      "The Agent sells the way your business sells. It looks up approved facts and the real catalogue. It does not invent prices.",
  },
  {
    title: "Humans stay in control",
    description:
      "You choose how much the Agent can do. Discounts, complaints and anything unsure stop it and brief a person.",
  },
  {
    title: "Built for service businesses",
    description:
      "Designed for teams selling real projects and services across solar, construction, roofing, electrical and related industries.",
  },
] as const;

export default function WhySegmiQSection() {
  return (
    <section className="overflow-x-clip bg-[var(--marketing-bg)]" aria-labelledby="why-segmiq-heading">
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 lg:pb-24">
        <div className="segmiq-split segmiq-split--flip">
          <div className="min-w-0">
            <h2
              id="why-segmiq-heading"
              className="max-w-[16ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[44px]"
            >
              Why service businesses in Africa choose SegmiQ
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)]">
              Built around the way service teams actually win work: conversations, an agent that carries
              the routine, and a person when it matters.
            </p>
            <ul className="segmiq-list mt-8">
              {REASONS.map((reason) => (
                <li key={reason.title}>
                  <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--marketing-text)]">
                    {reason.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                    {reason.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <figure className="segmiq-figure min-w-0">
            <Image
              src="/segmiq/visuals/africa-sales-manager-portrait.webp"
              alt="African service-business sales manager reviewing work on a tablet"
              width={819}
              height={655}
              sizes="(min-width: 1024px) 480px, 92vw"
              className="h-auto w-full object-cover object-[center_12%]"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
