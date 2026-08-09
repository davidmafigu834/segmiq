import type { ReactNode } from "react";
import {
  ArrowRight,
  FileText,
  FolderCheck,
  Link2,
  MessageSquareText,
  UserRoundCheck,
} from "lucide-react";
import CapturePreview from "@/components/marketing/landing/previews/CapturePreview";
import QualificationPreview from "@/components/marketing/landing/previews/QualificationPreview";
import FollowUpQuotePreview from "@/components/marketing/landing/previews/FollowUpQuotePreview";
import CloseDocumentPreview from "@/components/marketing/landing/previews/CloseDocumentPreview";

const STEPS: {
  title: string;
  description: string;
  Icon: typeof MessageSquareText;
  preview: ReactNode;
}[] = [
  {
    title: "Capture enquiries",
    description:
      "Bring enquiries from WhatsApp, Facebook ads, forms, referrals and field events into SegmiQ.",
    Icon: MessageSquareText,
    preview: <CapturePreview />,
  },
  {
    title: "Qualify & assign",
    description:
      "Use lead information and intent signals to prioritise the opportunity and route it to the right salesperson.",
    Icon: UserRoundCheck,
    preview: <QualificationPreview />,
  },
  {
    title: "Follow up & quote",
    description:
      "Call, WhatsApp, schedule follow-ups and send professional quotations without losing customer context.",
    Icon: FileText,
    preview: <FollowUpQuotePreview />,
  },
  {
    title: "Close & document work",
    description:
      "Record the outcome, keep the project history and turn completed work into proof your team can use again.",
    Icon: FolderCheck,
    preview: <CloseDocumentPreview />,
  },
];

export default function HowSegmiQWorksSection() {
  return (
    <section
      className="bg-[var(--marketing-bg-subtle)] marketing-halo marketing-halo--workflow"
      aria-labelledby="how-segmiq-works-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--marketing-olive)] sm:text-[12px]">
            How it works
          </p>
          <h2
            id="how-segmiq-works-heading"
            className="mt-2.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--marketing-text-heading)] sm:mt-3 sm:text-[34px] lg:text-[38px] lg:leading-[1.1]"
            style={{ fontWeight: 650 }}
          >
            From first enquiry to finished project — one connected workflow
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)] sm:text-[15px]">
            SegmiQ keeps every customer interaction connected, so your team always knows what
            happened, what happens next and who is responsible.
          </p>
        </div>

        {/* Desktop / tablet workflow container */}
        <div className="mt-8 hidden overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] shadow-[var(--marketing-card-shadow)] sm:mt-9 sm:block">
          <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={[
                  "relative p-5 xl:p-6",
                  index % 2 === 0 ? "md:border-r md:border-[var(--marketing-border-subtle)]" : "",
                  index < 2 ? "md:border-b md:border-[var(--marketing-border-subtle)] xl:border-b-0" : "",
                  index < STEPS.length - 1 ? "xl:border-r xl:border-[var(--marketing-border-subtle)]" : "",
                ].join(" ")}
              >
                {index < STEPS.length - 1 ? (
                  <span
                    className="pointer-events-none absolute right-0 top-8 z-10 hidden -translate-y-1/2 translate-x-1/2 text-[var(--marketing-text-muted)] xl:block"
                    aria-hidden
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)]">
                      <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </span>
                  </span>
                ) : null}

                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-brand)] text-[12px] font-bold text-[var(--marketing-brand-ink)]">
                    {index + 1}
                  </span>
                  <step.Icon
                    className="h-5 w-5 text-[var(--marketing-text-secondary)]"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                </div>

                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)] lg:text-[17px]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                  {step.description}
                </p>
                {step.preview}
              </li>
            ))}
          </ol>
        </div>

        {/* Mobile vertical timeline */}
        <ol className="relative mt-10 space-y-0 sm:hidden">
          <span
            className="absolute bottom-4 left-[13px] top-4 w-px bg-[var(--marketing-border-strong)]"
            aria-hidden
          />
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-8 last:pb-0"
            >
              <span className="relative z-[1] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--marketing-brand)] text-[12px] font-bold text-[var(--marketing-brand-ink)]">
                {index + 1}
              </span>
              <div className="min-w-0 rounded-[14px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-4 shadow-[var(--marketing-card-shadow)]">
                <div className="flex items-center gap-2">
                  <step.Icon
                    className="h-5 w-5 text-[var(--marketing-text-secondary)]"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-[14px] leading-[1.55] text-[var(--marketing-text-secondary)]">
                  {step.description}
                </p>
                {step.preview}
              </div>
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-7 flex max-w-[560px] items-start justify-center gap-2 text-center text-[13px] leading-snug text-[var(--marketing-text-label)] sm:mt-8 sm:text-[14px]">
          <Link2
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-olive)]"
            strokeWidth={1.8}
            aria-hidden
          />
          <span>One customer. One history. Every interaction connected.</span>
        </p>
      </div>
    </section>
  );
}
