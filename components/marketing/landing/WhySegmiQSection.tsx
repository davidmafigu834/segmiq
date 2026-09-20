import Image from "next/image";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

const REASONS: {
  title: string;
  description: string;
  icon: { src: string; alt: string };
  sources?: boolean;
}[] = [
  {
    title: "One place for every enquiry",
    description:
      "Capture WhatsApp, Facebook, website, referral and field enquiries in one organised sales system.",
    icon: {
      src: "/segmiq/visuals/why-icon-inbox.webp",
      alt: "Glass inbox gathering four channels into one place",
    },
    sources: true,
  },
  {
    title: "Agentic AI on WhatsApp",
    description:
      "SegmiQ Agent answers, qualifies and follows up so the first response is not waiting on someone to pick up the phone.",
    icon: {
      src: "/segmiq/visuals/why-icon-agent.webp",
      alt: "Glass agent node connected to a chat bubble",
    },
  },
  {
    title: "Company Brain, not guesswork",
    description:
      "The Agent sells the way your business sells. It looks up approved facts and the real catalogue — it does not invent prices.",
    icon: {
      src: "/segmiq/visuals/why-icon-brain.webp",
      alt: "Glass Company Brain sphere with lime neural threads",
    },
  },
  {
    title: "Humans stay in control",
    description:
      "You choose how much the Agent can do. Discounts, complaints and anything unsure stop it and brief a person.",
    icon: {
      src: "/segmiq/visuals/why-icon-control.webp",
      alt: "Glass shield with a human silhouette",
    },
  },
  {
    title: "Built for service businesses",
    description:
      "Designed for teams selling real projects and services across solar, construction, roofing, electrical and related industries.",
    icon: {
      src: "/segmiq/visuals/why-icon-industries.webp",
      alt: "Glass house with lime-edged solar panels",
    },
  },
];

function ReasonIcon({ src, compact }: { src: string; compact?: boolean }) {
  return (
    <span
      className={`relative block shrink-0 ${
        compact ? "h-12 w-12" : "h-14 w-14 sm:h-16 sm:w-16"
      }`}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        width={128}
        height={128}
        sizes="64px"
        className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(8,20,48,0.45)]"
      />
    </span>
  );
}

function ReasonContent({
  reason,
  compact,
}: {
  reason: (typeof REASONS)[number];
  compact?: boolean;
}) {
  return (
    <>
      <ReasonIcon src={reason.icon.src} compact={compact} />
      <div className={compact ? "min-w-0" : undefined}>
        <h3
          className={`font-semibold leading-snug tracking-[-0.015em] text-[var(--marketing-text)] ${
            compact ? "text-[15px]" : "mt-5 text-[15px] sm:text-[16px]"
          }`}
        >
          {reason.title}
        </h3>
        <p
          className={`leading-[1.55] text-[var(--marketing-text-secondary)] ${
            compact ? "mt-1.5 text-[13px]" : "mt-2.5 text-[13px] sm:text-[14px]"
          }`}
        >
          {reason.description}
        </p>
        {reason.sources ? (
          compact ? (
            <p className="mt-2 text-[11px] font-medium text-[var(--marketing-text-muted)]">
              WhatsApp · Facebook · Web · Referral
            </p>
          ) : (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-[var(--marketing-text-muted)]">
              <span className="inline-flex items-center gap-1">
                <SiWhatsapp size={11} color="#25D366" aria-hidden />
                WhatsApp
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <SiFacebook size={11} color="#1877F2" aria-hidden />
                Facebook
              </span>
              <span aria-hidden>·</span>
              <span>Web</span>
              <span aria-hidden>·</span>
              <span>Referral</span>
            </p>
          )
        ) : null}
      </div>
    </>
  );
}

export default function WhySegmiQSection() {
  return (
    <section className="marketing-halo marketing-halo--industry overflow-x-clip bg-[var(--marketing-bg-subtle)]" aria-labelledby="why-segmiq-heading">
      <SegmiQSectionAtmosphere tone="industry" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        {/* VISUAL:
            Type: REAL_PHOTO_CUTOUT
            Asset: African sales manager holding tablet — mid-thigh crop
            File: /public/segmiq/visuals/africa-sales-manager-portrait.webp
            Placement: right of left-aligned heading on all breakpoints
        */}
        <div className="relative grid grid-cols-[minmax(0,1.15fr)_minmax(148px,0.95fr)] items-center gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(240px,1fr)] sm:gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,1.05fr)] lg:items-end lg:gap-6 xl:gap-8">
          <div className="relative z-10 min-w-0 self-center text-left lg:pb-8">
            <p className="segmiq-kicker text-[11px] text-[var(--marketing-olive)] sm:text-[12px]">
              Why SegmiQ
            </p>
            <h2
              id="why-segmiq-heading"
              className="mt-2.5 max-w-[18ch] text-[32px] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[40px] lg:max-w-none lg:text-[46px]"
            >
              Why service businesses in Africa choose SegmiQ
            </h2>
            <p className="mt-3 max-w-[42ch] text-[14px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[15px]">
              Built around the way service teams actually win work — conversations, an agent that
              carries the routine, and a person when it matters.
            </p>
          </div>

          <div className="relative z-[2] -mb-10 justify-self-end self-end sm:-mb-14 lg:-mb-20 xl:-mb-[96px]">
            <div
              className="pointer-events-none absolute inset-x-[10%] bottom-[8%] h-[30%] rounded-full bg-[rgba(52,88,164,0.32)] blur-3xl"
              aria-hidden
            />
            <Image
              src="/segmiq/visuals/africa-sales-manager-portrait.webp"
              alt="African service-business sales manager reviewing work on a tablet"
              width={819}
              height={655}
              sizes="(min-width: 1280px) 540px, (min-width: 1024px) 460px, (min-width: 640px) 340px, 210px"
              className="relative z-[1] h-[268px] w-auto max-w-none origin-bottom scale-[1.22] object-cover object-[center_8%] sm:h-[360px] sm:scale-[1.16] md:h-[430px] lg:h-[520px] lg:scale-[1.08] xl:h-[580px] xl:scale-[1.06] [mask-image:linear-gradient(to_bottom,#000_52%,transparent_96%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_52%,transparent_96%)]"
            />
          </div>
        </div>

        {/* XL: five equal columns in one shared container */}
        <ul className="relative z-0 mt-2 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] xl:grid xl:grid-cols-5 segmiq-glass sm:mt-3 lg:mt-4">
          {REASONS.map((reason, index) => (
            <li
              key={reason.title}
              className={`group/reason flex flex-col px-[22px] py-7 transition-colors duration-200 hover:bg-[var(--marketing-row-hover)] ${
                index > 0 ? "border-l border-[var(--marketing-border-subtle)]" : ""
              }`}
            >
              <ReasonContent reason={reason} />
            </li>
          ))}
        </ul>

        {/* LG: 3 + 2 */}
        <ul className="relative z-0 mt-2 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] lg:mt-4 lg:grid lg:grid-cols-3 xl:hidden segmiq-glass">
          {REASONS.map((reason, index) => (
            <li
              key={reason.title}
              className={[
                "group/reason flex flex-col px-[22px] py-7 transition-colors duration-200 hover:bg-[var(--marketing-row-hover)]",
                index % 3 !== 2 ? "border-r border-[var(--marketing-border-subtle)]" : "",
                index < 3 ? "border-b border-[var(--marketing-border-subtle)]" : "",
                index === 3 ? "lg:col-start-1" : "",
                index === 4 ? "lg:col-start-2" : "",
              ].join(" ")}
            >
              <ReasonContent reason={reason} />
            </li>
          ))}
        </ul>

        {/* MD tablet: 2 cols, last full-width */}
        <ul className="relative z-0 mt-2 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] md:mt-3 md:grid md:grid-cols-2 lg:hidden segmiq-glass">
          {REASONS.map((reason, index) => (
            <li
              key={reason.title}
              className={[
                "group/reason flex flex-col px-5 py-6 transition-colors duration-200 hover:bg-[var(--marketing-row-hover)] sm:px-[22px] sm:py-7",
                index % 2 === 0 && index < 4 ? "border-r border-[var(--marketing-border-subtle)]" : "",
                index < 4 ? "border-b border-[var(--marketing-border-subtle)]" : "",
                index === 4 ? "md:col-span-2 md:max-w-none" : "",
              ].join(" ")}
            >
              <ReasonContent reason={reason} />
            </li>
          ))}
        </ul>

        {/* Mobile compact rows */}
        <ul className="relative z-0 mt-2 overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] md:hidden segmiq-glass">
          {REASONS.map((reason, index) => (
            <li
              key={reason.title}
              className={`grid grid-cols-[48px_minmax(0,1fr)] gap-3.5 px-4 py-5 ${
                index > 0 ? "border-t border-[var(--marketing-border-subtle)]" : ""
              }`}
            >
              <ReasonContent reason={reason} compact />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
