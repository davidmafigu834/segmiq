import Link from "next/link";
import { ArrowRight, CalendarDays, Check } from "lucide-react";
import { ML } from "@/lib/marketing-links";

function DemoPreviewCard() {
  return (
    <div
      className="w-full rounded-xl border border-[rgba(16,24,40,0.10)] bg-white/82 p-4 sm:w-[240px] sm:shrink-0 dark:border-white/10 dark:bg-[rgba(10,20,45,0.65)] dark:backdrop-blur-xl"
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(16,24,40,0.06)] text-[#101828] dark:bg-white/10 dark:text-white">
          <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475467] dark:text-white/50">
            SegmiQ demo
          </p>
          <p className="text-[13px] font-semibold text-[#101828] dark:text-white">30 min</p>
        </div>
      </div>

      <ul className="mt-3.5 space-y-2">
        {["See the platform", "Ask questions", "Plan your setup"].map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-[12px] font-medium text-[#344054] dark:text-white/70"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#D4FF4F]">
              <Check className="h-2.5 w-2.5 text-[#101828]" strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Light: lime panel. Dark: violet/indigo glass with SegmiQ lime CTA. */
export default function FinalCTASection() {
  return (
    <section
      className="marketing-halo marketing-halo--cta bg-[var(--marketing-bg)]"
      aria-labelledby="final-cta-heading"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-12 pt-12 sm:px-10 sm:pb-14 sm:pt-14 lg:px-12 lg:pb-16 lg:pt-16">
        <div className="segmiq-cta-panel relative overflow-hidden rounded-2xl px-5 py-7 shadow-[0_8px_30px_rgba(16,24,40,0.06)] sm:px-8 sm:py-8 lg:px-10 lg:py-9 dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_auto] lg:gap-10">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[rgba(16,24,40,0.62)] sm:text-[11px] dark:text-white/48">
                Ready when you are
              </p>
              <h2
                id="final-cta-heading"
                className="mt-2.5 max-w-[680px] text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#101828] sm:text-[36px] lg:text-[38px] dark:text-white"
                style={{ fontWeight: 650 }}
              >
                Ready to see SegmiQ in action?
              </h2>
              <p className="mt-3 max-w-[640px] text-[14px] leading-[1.55] text-[#344054] sm:mt-3.5 sm:text-[15px] lg:text-[16px] dark:text-white/68">
                Book a personalised demo and see how SegmiQ can help your team capture more
                opportunities, follow up consistently and close more deals.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <Link
                  href={ML.contact}
                  className="segmiq-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[#101828] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#1D2939] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#D4FF4F] sm:h-[52px] sm:w-auto sm:px-7 dark:bg-[#D4FF4F] dark:text-[#06152E] dark:hover:bg-[#c7f238] dark:focus-visible:ring-[#D4FF4F] dark:focus-visible:ring-offset-[#06152E]"
                >
                  Book a demo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={ML.crm}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#101828]/75 transition-colors hover:text-[#101828] sm:text-[14px] dark:text-white/68 dark:hover:text-white"
                >
                  See the platform
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>

              <p className="mt-3.5 text-[12px] leading-snug text-[rgba(16,24,40,0.65)] dark:text-white/48">
                No pressure. See how SegmiQ would fit your sales process.
              </p>
            </div>

            <DemoPreviewCard />
          </div>
        </div>
      </div>
    </section>
  );
}
