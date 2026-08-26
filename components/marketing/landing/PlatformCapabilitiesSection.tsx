import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Columns3, FileText, type LucideIcon } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { ML } from "@/lib/marketing-links";
import MarketingWhatsAppPreview from "@/components/marketing/landing/previews/MarketingWhatsAppPreview";
import MarketingPipelinePreview from "@/components/marketing/landing/previews/MarketingPipelinePreview";
import MarketingQuotePreview from "@/components/marketing/landing/previews/MarketingQuotePreview";
import MarketingCloudPreview from "@/components/marketing/landing/previews/MarketingCloudPreview";

type Capability = {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  icon: "whatsapp" | LucideIcon;
  iconTint: string;
  preview: ReactNode;
};

const CAPABILITIES: Capability[] = [
  {
    title: "WhatsApp Sales Hub",
    description:
      "Manage WhatsApp conversations from one shared business number. Assign leads, respond faster and keep every sales conversation connected to the customer.",
    href: ML.featuresWhatsapp,
    icon: "whatsapp",
    iconTint: "marketing-feature-icon--whatsapp bg-[#ECFDF3] text-[#25D366]",
    preview: <MarketingWhatsAppPreview />,
  },
  {
    title: "Pipeline & Lead Management",
    description:
      "Capture every lead, see who needs attention and move opportunities from first enquiry to closed deal.",
    href: ML.crm,
    icon: Columns3,
    iconTint: "bg-[#EFF8FF] text-[#175CD3]",
    preview: <MarketingPipelinePreview />,
  },
  {
    title: "Quotes & Follow-ups",
    description:
      "Create professional quotations, send them to customers and stay on top of every promised follow-up.",
    href: ML.featuresConvert,
    icon: FileText,
    iconTint: "bg-[#F7FEE7] text-[#4D7C0F]",
    preview: <MarketingQuotePreview />,
  },
  {
    title: "SegmiQ Cloud",
    description:
      "Keep completed projects organised with photos, documents and customer-ready project records — all connected to the work your team has delivered.",
    href: ML.cloud,
    external: true,
    icon: Cloud,
    iconTint: "bg-[#F5F3FF] text-[#6941C6]",
    preview: <MarketingCloudPreview />,
  },
];

function CapabilityCard({ item }: { item: Capability }) {
  const linkClass =
    "group/link inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--marketing-link)] transition-colors hover:text-[var(--marketing-link-hover)]";

  const learnMore = item.external ? (
    <a href={item.href} className={linkClass} target="_blank" rel="noopener noreferrer">
      Learn more
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/card:translate-x-0.5"
        aria-hidden
      />
    </a>
  ) : (
    <Link href={item.href} className={linkClass}>
      Learn more
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/card:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );

  return (
    <article className="marketing-feature-card segmiq-glass group/card flex h-full flex-col overflow-hidden rounded-[15px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] shadow-[var(--marketing-card-shadow)] transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--marketing-border-strong)] hover:shadow-[var(--marketing-card-shadow-hover)]">
      <div className="flex flex-1 flex-col px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-center gap-2.5">
          <span
            className={`marketing-feature-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${item.iconTint}`}
          >
            {item.icon === "whatsapp" ? (
              <SiWhatsapp size={18} color="#25D366" aria-hidden />
            ) : (
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
            )}
          </span>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)] sm:text-[16px]">
            {item.title}
          </h3>
        </div>

        <p className="mt-2.5 flex-1 text-[13px] leading-[1.5] text-[var(--marketing-text-secondary)] sm:text-[14px]">
          {item.description}
        </p>

        <div className="mt-3">{learnMore}</div>
      </div>

      <div className="mt-auto px-2 pb-0 transition-transform duration-200 ease-out group-hover/card:-translate-y-0.5 sm:px-2.5">
        {item.preview}
      </div>
    </article>
  );
}

export default function PlatformCapabilitiesSection() {
  return (
    <section
      className="bg-[var(--marketing-bg-soft)] marketing-halo marketing-halo--center"
      aria-labelledby="platform-capabilities-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--marketing-olive)] sm:text-[12px]">
            The SegmiQ Platform
          </p>
          <h2
            id="platform-capabilities-heading"
            className="mt-2.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[34px] lg:text-[38px] lg:leading-[1.1]"
            style={{ fontWeight: 650 }}
          >
            Everything you need to run and grow your service business
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[15px]">
            Capture the enquiry, manage the conversation, send the quote, close the deal and
            document the work — without switching between disconnected systems.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-9 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-4">
          {CAPABILITIES.map((item) => (
            <CapabilityCard key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
