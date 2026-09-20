import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cloud, Columns3, FileText, type LucideIcon } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { ML } from "@/lib/marketing-links";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

type Capability = {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  icon: "whatsapp" | LucideIcon;
  iconTint: string;
  visual: {
    src: string;
    alt: string;
  };
};

const CAPABILITIES: Capability[] = [
  {
    title: "WhatsApp Sales Hub",
    description:
      "Manage WhatsApp conversations from one shared business number. SegmiQ Agent can handle the first stretch — every message stays connected to the customer.",
    href: ML.featuresWhatsapp,
    icon: "whatsapp",
    iconTint: "marketing-feature-icon--whatsapp bg-[#ECFDF3] text-[#25D366]",
    visual: {
      src: "/segmiq/visuals/platform-whatsapp.webp",
      alt: "Sales conversations inbox with Tafadzwa Moyo, Sunharvest, Ruvimbo Tawanda and Memory Phiri on WhatsApp.",
    },
  },
  {
    title: "Pipeline & Lead Management",
    description:
      "Capture every lead, see who needs attention and move opportunities from first enquiry to closed deal.",
    href: ML.crm,
    icon: Columns3,
    iconTint: "bg-[#EFF8FF] text-[#175CD3]",
    visual: {
      src: "/segmiq/visuals/platform-pipeline.webp",
      alt: "Pipeline stages New, Contacted, Negotiating and Proposal sent with lead values and Kelvin Manyika highlighted.",
    },
  },
  {
    title: "Quotes & Follow-ups",
    description:
      "Create professional quotations, send them to customers and stay on top of every promised follow-up.",
    href: ML.featuresConvert,
    icon: FileText,
    iconTint: "bg-[#F7FEE7] text-[#4D7C0F]",
    visual: {
      src: "/segmiq/visuals/platform-quotes.webp",
      alt: "Quote Q-2026-045 for Samson Kandare at $18,400 with a follow-up tomorrow at 09:00.",
    },
  },
  {
    title: "SegmiQ Cloud",
    description:
      "Keep completed projects organised with photos, documents and customer-ready project records — all connected to the work your team has delivered.",
    href: ML.cloud,
    external: true,
    icon: Cloud,
    iconTint: "bg-[#F5F3FF] text-[#6941C6]",
    visual: {
      src: "/segmiq/visuals/platform-cloud.webp",
      alt: "Completed Borrowdale Solar Installation project with site documentation, photos, documents and proposal.",
    },
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

      <div className="mt-auto px-2 pb-2 sm:px-2.5 sm:pb-2.5">
        <div className="overflow-hidden rounded-[12px]">
          <Image
            src={item.visual.src}
            alt={item.visual.alt}
            width={1024}
            height={1024}
            sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 92vw"
            className="h-auto w-full transition-transform duration-200 ease-out group-hover/card:scale-[1.02]"
          />
        </div>
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
      <SegmiQSectionAtmosphere tone="platform" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="segmiq-kicker text-[11px] text-[var(--marketing-olive)] sm:text-[12px]">
            The revenue OS
          </p>
          <h2
            id="platform-capabilities-heading"
            className="mt-2.5 text-[32px] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[40px] lg:text-[46px]"
          >
            The system Agentic AI runs on
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[14px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[15px]">
            WhatsApp, pipeline, quotations and project records stay canonical. SegmiQ Agent uses
            them — it does not replace them.
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
