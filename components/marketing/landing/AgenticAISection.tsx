import Link from "next/link";
import AgentActivityPreview from "@/components/marketing/landing/previews/AgentActivityPreview";
import { ML } from "@/lib/marketing-links";

const CAPABILITIES = [
  {
    title: "Answers on WhatsApp",
    description:
      "Replies in your company’s voice. Short commercial messages, not a generic chatbot dump.",
  },
  {
    title: "Qualifies into the CRM",
    description:
      "Writes budget, need, timeline and location onto the lead, then creates a deal when intent is real.",
  },
  {
    title: "Quotes from the catalogue",
    description:
      "Looks up real packages and prices. It prepares a quotation. Sending stays gated by your policy.",
  },
  {
    title: "Follows up, or stops",
    description:
      "Books callbacks, sets follow-ups, and brings a human in for discounts, complaints or anything unsure.",
  },
] as const;

export default function AgenticAISection() {
  return (
    <section
      id="agentic-ai"
      className="scroll-mt-[72px] bg-[var(--marketing-bg)]"
      aria-labelledby="agentic-ai-heading"
    >
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 sm:pt-10 lg:pb-24 lg:pt-12">
        <div className="segmiq-split">
          <div className="min-w-0">
            <h2
              id="agentic-ai-heading"
              className="max-w-[16ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[44px]"
            >
              Not a chatbot. An agent that operates the sale.
            </h2>
            <p className="mt-4 max-w-[54ch] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)]">
              SegmiQ Agent sits on your WhatsApp Sales Hub and works inside the CRM: catalogue,
              qualification, quotations, calendar and follow-ups. Company Brain teaches it how your
              business sells. It never invents a price, and it never pretends to be a person.
            </p>

            <ul className="segmiq-list mt-8">
              {CAPABILITIES.map((item) => (
                <li key={item.title}>
                  <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-[1.5] text-[var(--marketing-text-secondary)]">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>

            <p className="mt-8 max-w-[52ch] text-[13px] leading-snug text-[var(--marketing-text-label)]">
              You choose the mode: draft only, reply on WhatsApp, or send approved quotes within your
              limits.{" "}
              <Link href={ML.brain} className="font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]">
                See how Company Brain is taught
              </Link>
              .
            </p>
          </div>

          <div className="min-w-0">
            <AgentActivityPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
