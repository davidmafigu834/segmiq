import {
  BriefcaseBusiness,
  CalendarCheck2,
  FileCheck2,
  Inbox,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";

const REASONS: {
  title: string;
  description: string;
  Icon: LucideIcon;
  sources?: boolean;
}[] = [
  {
    title: "One place for every enquiry",
    description:
      "Capture WhatsApp, Facebook, website, referral and field enquiries in one organised sales system.",
    Icon: Inbox,
    sources: true,
  },
  {
    title: "Faster team response",
    description:
      "Route new enquiries quickly so the right salesperson can respond while the opportunity is still fresh.",
    Icon: Zap,
  },
  {
    title: "Better follow-up discipline",
    description:
      "Keep calls, tasks and promised follow-ups visible so opportunities do not disappear simply because someone forgot.",
    Icon: CalendarCheck2,
  },
  {
    title: "Quotes connected to the sale",
    description:
      "Create quotations inside the sales workflow and keep the quote, conversation and next action connected to the same opportunity.",
    Icon: FileCheck2,
  },
  {
    title: "Built for service businesses",
    description:
      "Designed for teams selling real projects and services across solar, construction, roofing, electrical and related industries.",
    Icon: BriefcaseBusiness,
  },
];

function ReasonIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[rgba(180,220,60,0.22)] bg-[rgba(212,255,79,0.14)] text-[#536600] transition-colors duration-200 group-hover/reason:bg-[rgba(212,255,79,0.22)] sm:h-10 sm:w-10 dark:border-[rgba(212,255,79,0.12)] dark:bg-[rgba(212,255,79,0.10)] dark:text-[#D4FF4F] dark:group-hover/reason:bg-[rgba(212,255,79,0.16)]"
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
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
      <ReasonIcon Icon={reason.Icon} />
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
    <section className="bg-[var(--marketing-bg-subtle)]" aria-labelledby="why-segmiq-heading">
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--marketing-olive)] sm:text-[12px]">
            Why SegmiQ
          </p>
          <h2
            id="why-segmiq-heading"
            className="mt-2.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[34px] lg:text-[38px] lg:leading-[1.1]"
            style={{ fontWeight: 650 }}
          >
            Why service businesses in Africa choose SegmiQ
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[15px]">
            Built around the way service teams actually win work — through conversations, fast
            follow-up, clear ownership and trust.
          </p>
        </div>

        {/* XL: five equal columns in one shared container */}
        <ul className="mt-8 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] xl:grid xl:grid-cols-5">
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
        <ul className="mt-8 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] lg:grid lg:grid-cols-3 xl:hidden">
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
        <ul className="mt-8 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] md:grid md:grid-cols-2 lg:hidden">
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
        <ul className="mt-8 overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] md:hidden">
          {REASONS.map((reason, index) => (
            <li
              key={reason.title}
              className={`grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 px-4 py-5 ${
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
