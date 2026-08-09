import type { ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import SalesCommandCenterPreview from "@/components/marketing/landing/previews/SalesCommandCenterPreview";
import WhatsAppSalesHubPreview from "@/components/marketing/landing/previews/WhatsAppSalesHubPreview";

function BenefitList({ items, mobileLimit }: { items: string[]; mobileLimit?: number }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((text, i) => (
        <li
          key={text}
          className={`flex items-start gap-2.5 text-[13px] leading-snug text-[var(--marketing-text-label)] sm:text-[14px] ${
            mobileLimit != null && i >= mobileLimit ? "hidden sm:flex" : ""
          }`}
        >
          <span
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-check-bg)]"
            aria-hidden
          >
            <Check
              className="h-2.5 w-2.5 text-[var(--marketing-check-fg)]"
              strokeWidth={3}
            />
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

function ShowcaseCard({
  label,
  title,
  titleIcon,
  description,
  benefits,
  mobileBenefitLimit,
  preview,
}: {
  label: string;
  title: string;
  titleIcon?: LucideIcon | "whatsapp";
  description: string;
  benefits: string[];
  mobileBenefitLimit: number;
  preview: ReactNode;
}) {
  const TitleIcon = titleIcon && titleIcon !== "whatsapp" ? titleIcon : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-[17px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] shadow-[var(--marketing-card-shadow)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-[var(--marketing-border-strong)] hover:shadow-[var(--marketing-card-shadow-hover)]">
      <div className="px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--marketing-olive)] sm:text-[11px]">
          {label}
        </p>
        <h3 className="mt-1.5 flex items-center gap-2 text-[20px] font-semibold tracking-[-0.025em] text-[var(--marketing-text)] sm:text-[22px]">
          {titleIcon === "whatsapp" ? (
            <SiWhatsapp size={20} color="#25D366" aria-hidden />
          ) : TitleIcon ? (
            <TitleIcon
              className="h-5 w-5 text-[var(--marketing-text-secondary)]"
              strokeWidth={1.8}
              aria-hidden
            />
          ) : null}
          {title}
        </h3>
        <p className="mt-2 max-w-[420px] text-[13px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[14px]">
          {description}
        </p>
        <BenefitList items={benefits} mobileLimit={mobileBenefitLimit} />
      </div>

      <div className="mt-auto px-0">{preview}</div>
    </article>
  );
}

export default function TeamSalesSection() {
  return (
    <section
      className="bg-[var(--marketing-bg)] marketing-halo marketing-halo--showcase"
      aria-labelledby="team-sales-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[680px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--marketing-olive)] sm:text-[12px]">
            Built for real sales teams
          </p>
          <h2
            id="team-sales-heading"
            className="mt-2.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[34px] lg:text-[38px] lg:leading-[1.1]"
            style={{ fontWeight: 650 }}
          >
            Built for the way your team actually sells
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[15px]">
            Give managers the visibility to lead the team — and give salespeople the tools to
            respond, follow up and close from one connected system.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-9 xl:grid-cols-2 xl:gap-5">
          <ShowcaseCard
            label="For managers"
            title="Sales Command Center"
            description="See what needs attention, where deals are moving and how your sales activity is performing — without chasing updates from the team."
            benefits={[
              "See what matters every morning",
              "Prioritise follow-ups and tasks",
              "Track pipeline and sales performance",
              "Spot problems before deals go cold",
            ]}
            mobileBenefitLimit={3}
            preview={<SalesCommandCenterPreview />}
          />
          <ShowcaseCard
            label="For salespeople"
            title="WhatsApp Sales Hub"
            titleIcon="whatsapp"
            description="Give your sales team one shared place to manage WhatsApp enquiries, respond faster and keep every conversation connected to the deal."
            benefits={[
              "One business number for the team",
              "Assign and track conversations",
              "Use quick replies and sales assets",
              "Never miss a customer message",
            ]}
            mobileBenefitLimit={3}
            preview={<WhatsAppSalesHubPreview />}
          />
        </div>
      </div>
    </section>
  );
}
