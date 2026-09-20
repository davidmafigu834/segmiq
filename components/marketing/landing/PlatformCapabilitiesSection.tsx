import Image from "next/image";
import Link from "next/link";
import { ML } from "@/lib/marketing-links";

type Capability = {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  visual: { src: string; alt: string };
};

const FEATURED: Capability = {
  title: "WhatsApp Sales Hub",
  description:
    "Manage WhatsApp conversations from one shared business number. SegmiQ Agent can handle the first stretch. Every message stays connected to the customer.",
  href: ML.featuresWhatsapp,
  visual: {
    src: "/segmiq/visuals/platform-whatsapp.webp",
    alt: "Sales conversations inbox with Tafadzwa Moyo, Sunharvest, Ruvimbo Tawanda and Memory Phiri on WhatsApp.",
  },
};

const REST: Capability[] = [
  {
    title: "Pipeline and lead management",
    description:
      "Capture every lead, see who needs attention and move opportunities from first enquiry to closed deal.",
    href: ML.crm,
    visual: {
      src: "/segmiq/visuals/platform-pipeline.webp",
      alt: "Pipeline stages New, Contacted, Negotiating and Proposal sent with lead values and Kelvin Manyika highlighted.",
    },
  },
  {
    title: "Quotes and follow-ups",
    description:
      "Create professional quotations, send them to customers and stay on top of every promised follow-up.",
    href: ML.featuresConvert,
    visual: {
      src: "/segmiq/visuals/platform-quotes.webp",
      alt: "Quote Q-2026-045 for Samson Kandare at $18,400 with a follow-up tomorrow at 09:00.",
    },
  },
  {
    title: "SegmiQ Cloud",
    description:
      "Keep completed projects organised with photos, documents and customer-ready records, connected to the work your team delivered.",
    href: ML.cloud,
    external: true,
    visual: {
      src: "/segmiq/visuals/platform-cloud.webp",
      alt: "Completed Borrowdale Solar Installation project with site documentation, photos, documents and proposal.",
    },
  },
];

function ProductLink({ item }: { item: Capability }) {
  const className =
    "mt-3 inline-flex text-[13px] font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]";
  if (item.external) {
    return (
      <a href={item.href} className={className} target="_blank" rel="noopener noreferrer">
        {item.title}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {item.title}
    </Link>
  );
}

export default function PlatformCapabilitiesSection() {
  return (
    <section className="bg-[var(--marketing-bg)]" aria-labelledby="platform-capabilities-heading">
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 lg:pb-24">
        <h2
          id="platform-capabilities-heading"
          className="max-w-[18ch] text-[32px] text-[var(--marketing-text-heading)] sm:text-[40px] lg:text-[44px]"
        >
          The system Agentic AI runs on
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.6] text-[var(--marketing-text-secondary)]">
          WhatsApp, pipeline, quotations and project records stay canonical. SegmiQ Agent uses them. It
          does not replace them.
        </p>

        <div className="segmiq-split mt-10">
          <div className="min-w-0">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--marketing-text)]">
              {FEATURED.title}
            </h3>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-[1.55] text-[var(--marketing-text-secondary)]">
              {FEATURED.description}
            </p>
            <ProductLink item={FEATURED} />
          </div>
          <figure className="segmiq-figure">
            <Image
              src={FEATURED.visual.src}
              alt={FEATURED.visual.alt}
              width={1024}
              height={1024}
              sizes="(min-width: 1024px) 480px, 92vw"
              className="h-auto w-full"
            />
          </figure>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {REST.map((item) => (
            <li key={item.title} className="min-w-0">
              <figure className="segmiq-figure">
                <Image
                  src={item.visual.src}
                  alt={item.visual.alt}
                  width={1024}
                  height={1024}
                  sizes="(min-width: 1280px) 280px, (min-width: 640px) 30vw, 92vw"
                  className="h-auto w-full"
                />
              </figure>
              <ProductLink item={item} />
              <p className="mt-2 text-[13px] leading-[1.5] text-[var(--marketing-text-secondary)]">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
