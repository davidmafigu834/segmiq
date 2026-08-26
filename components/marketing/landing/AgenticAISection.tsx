import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { BookOpen, Bot, CalendarCheck2, FileText, MessageSquareText, ShieldCheck } from "lucide-react";
import AgentActivityPreview from "@/components/marketing/landing/previews/AgentActivityPreview";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";
import { ML } from "@/lib/marketing-links";

const CAPABILITIES: {
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Answers on WhatsApp",
    description:
      "Replies to enquiries in your company’s voice — short, commercial messages, not a generic chatbot dump.",
    Icon: MessageSquareText,
  },
  {
    title: "Qualifies into the CRM",
    description:
      "Writes budget, need, timeline and location onto the lead, then creates a deal when intent is real.",
    Icon: Bot,
  },
  {
    title: "Quotes from the catalogue",
    description:
      "Looks up real packages and prices. It prepares a quotation. Sending stays gated by your policy.",
    Icon: FileText,
  },
  {
    title: "Follows up — or stops",
    description:
      "Books callbacks, sets follow-ups, and brings a human in for discounts, complaints or anything unsure.",
    Icon: CalendarCheck2,
  },
];

export default function AgenticAISection() {
  return (
    <section
      id="agentic-ai"
      className="scroll-mt-[72px] bg-[var(--marketing-bg-soft)] marketing-halo marketing-halo--agentic"
      aria-labelledby="agentic-ai-heading"
    >
      <SegmiQSectionAtmosphere tone="agentic" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
          <div className="min-w-0">
            <div className="text-center lg:text-left">
              <p className="segmiq-kicker text-[11px] text-[var(--marketing-olive)] sm:text-[12px]">
                SegmiQ Agentic AI
              </p>
              <h2
                id="agentic-ai-heading"
                className="mx-auto mt-2.5 max-w-[18ch] text-[32px] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[40px] lg:mx-0 lg:max-w-none lg:text-[46px]"
              >
                Not a chatbot. An agent that operates the sale.
              </h2>
              <p className="mx-auto mt-4 max-w-[540px] text-[14px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[15px] lg:mx-0">
                SegmiQ Agent sits on your WhatsApp Sales Hub and works inside the CRM — catalogue,
                qualification, quotations, calendar and follow-ups. Company Brain teaches it how{" "}
                <em className="not-italic text-[var(--marketing-text)]">your</em> business sells. It
                never invents a price, and it never pretends to be a person.
              </p>
            </div>

            <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {CAPABILITIES.map((item) => (
                <li
                  key={item.title}
                  className="segmiq-glass rounded-[14px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-4"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(180,220,60,0.22)] bg-[rgba(212,255,79,0.14)] text-[#536600] dark:border-[rgba(212,255,79,0.12)] dark:bg-[rgba(212,255,79,0.10)] dark:text-[#D4FF4F]">
                    <item.Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--marketing-text-secondary)]">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-8">
              <p className="flex items-start gap-2 text-[13px] leading-snug text-[var(--marketing-text-label)]">
                <BookOpen
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-olive)]"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span>
                  Company Brain holds how you sell, serve and decide — the Agent looks it up, it does
                  not guess.{" "}
                  <Link href={ML.brain} className="font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]">
                    See how it is taught
                  </Link>
                  .
                </span>
              </p>
              <p className="flex items-start gap-2 text-[13px] leading-snug text-[var(--marketing-text-label)]">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-olive)]"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span>You choose the mode: draft only, reply on WhatsApp, or send approved quotes within your limits.</span>
              </p>
            </div>
          </div>

          <div className="min-w-0 lg:pt-10">
            <AgentActivityPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
