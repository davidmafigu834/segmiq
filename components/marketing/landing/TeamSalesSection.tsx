import type { ReactNode } from "react";
import SalesCommandCenterPreview from "@/components/marketing/landing/previews/SalesCommandCenterPreview";
import WhatsAppSalesHubPreview from "@/components/marketing/landing/previews/WhatsAppSalesHubPreview";

function BenefitList({ items }: { items: string[] }) {
  return (
    <ul className="segmiq-list mt-5">
      {items.map((text) => (
        <li key={text} className="text-[14px] leading-snug text-[var(--marketing-text-label)]">
          {text}
        </li>
      ))}
    </ul>
  );
}

function Showcase({
  title,
  description,
  benefits,
  preview,
  flip,
}: {
  title: string;
  description: string;
  benefits: string[];
  preview: ReactNode;
  flip?: boolean;
}) {
  return (
    <article className={`segmiq-split ${flip ? "segmiq-split--flip" : ""}`}>
      <div className="min-w-0">
        <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--marketing-text)] sm:text-[24px]">
          {title}
        </h3>
        <p className="mt-3 max-w-[48ch] text-[15px] leading-[1.55] text-[var(--marketing-text-secondary)]">
          {description}
        </p>
        <BenefitList items={benefits} />
      </div>
      <div className="min-w-0">{preview}</div>
    </article>
  );
}

export default function TeamSalesSection() {
  return (
    <section className="bg-[var(--marketing-bg)]" aria-labelledby="team-sales-heading">
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 lg:pb-24">
        <h2
          id="team-sales-heading"
          className="max-w-[16ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[44px]"
        >
          Your team stays in charge of the Agent
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)]">
          Managers see what SegmiQ Agent did overnight. Salespeople take over the conversations that
          need a person, with the full history already written.
        </p>

        <div className="mt-12 flex flex-col gap-16 lg:gap-20">
          <Showcase
            title="Sales Command Center"
            description="See what needs attention, including conversations SegmiQ Agent handed to a person, without chasing updates from the team."
            benefits={[
              "See Human Needed the moment the Agent stops",
              "Review what the Agent qualified and quoted",
              "Track pipeline and sales performance",
              "Spot problems before deals go cold",
            ]}
            preview={<SalesCommandCenterPreview />}
          />
          <Showcase
            title="WhatsApp Sales Hub"
            description="One shared place for WhatsApp. SegmiQ Agent handles the first stretch, then a person takes over with the conversation already qualified."
            benefits={[
              "One business number for the team",
              "Agent replies while the team is offline",
              "Take over when a human is needed",
              "Every message stays on the deal",
            ]}
            preview={<WhatsAppSalesHubPreview />}
            flip
          />
        </div>
      </div>
    </section>
  );
}
