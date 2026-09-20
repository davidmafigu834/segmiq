import Image from "next/image";

const BEATS = [
  {
    title: "Teach it",
    body: "How you sell, where you serve, how you sound, what you never promise. Playbooks, FAQs, approved documents, rules.",
  },
  {
    title: "It looks it up",
    body: "On every enquiry the Agent retrieves approved facts and the live catalogue. Missing facts stay missing. It does not fill gaps from the internet.",
  },
  {
    title: "It stops",
    body: "Discounts, coverage you don’t have, anything unsure: it escalates and briefs a person. That is the system working.",
  },
] as const;

export default function CompanyBrainSection() {
  return (
    <section
      id="company-brain"
      className="scroll-mt-[72px] bg-[var(--marketing-bg)]"
      aria-labelledby="company-brain-heading"
    >
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 sm:pt-10 lg:pb-24">
        <h2
          id="company-brain-heading"
          className="max-w-[16ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[44px]"
        >
          Generic AI guesses. <span className="lime">Yours looks it up.</span>
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)]">
          Company Brain is the operating context SegmiQ Agent is allowed to use. You teach it how this
          company sells, serves and decides. It retrieves approved facts. It never invents a price, a
          suburb, or a promise.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
          <ol className="segmiq-list">
            {BEATS.map((beat) => (
              <li key={beat.title}>
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                  {beat.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                  {beat.body}
                </p>
              </li>
            ))}
          </ol>

          <figure className="segmiq-figure">
            <Image
              src="/segmiq/visuals/company-brain-readiness.webp"
              alt="Company Brain for Adlense Solar: Business Profile, What We Sell, playbooks, Service Areas, FAQs and Escalation marked ready."
              width={682}
              height={1024}
              sizes="(min-width: 1024px) 520px, 92vw"
              className="h-auto w-full"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
