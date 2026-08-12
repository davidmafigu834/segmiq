import { CircleCheck } from "lucide-react";
import ProductHeroVisual from "@/components/marketing/landing/ProductHeroVisual";

export type AuthMarketingVariant = "login" | "forgot" | "reset" | "signup";

const COPY: Record<
  AuthMarketingVariant,
  {
    headline: string;
    support: string;
    outcomes: readonly string[];
  }
> = {
  login: {
    headline: "Your sales day starts here.",
    support:
      "Stay on top of enquiries, follow-ups, conversations, quotes and opportunities from one connected workspace.",
    outcomes: [
      "Capture every enquiry",
      "Know who needs attention next",
      "Keep follow-ups and quotations connected",
      "Manage sales conversations in one place",
    ],
  },
  forgot: {
    headline: "Your sales day starts here.",
    support:
      "Stay on top of enquiries, follow-ups, conversations, quotes and opportunities from one connected workspace.",
    outcomes: [
      "Capture every enquiry",
      "Know who needs attention next",
      "Keep follow-ups and quotations connected",
      "Manage sales conversations in one place",
    ],
  },
  reset: {
    headline: "Your sales day starts here.",
    support:
      "Stay on top of enquiries, follow-ups, conversations, quotes and opportunities from one connected workspace.",
    outcomes: [
      "Capture every enquiry",
      "Know who needs attention next",
      "Keep follow-ups and quotations connected",
      "Manage sales conversations in one place",
    ],
  },
  signup: {
    headline: "Bring your sales process into one system.",
    support:
      "Capture enquiries, organise follow-ups, manage conversations and keep every opportunity moving with SegmiQ.",
    outcomes: [
      "One place for new enquiries",
      "A clear sales pipeline",
      "Follow-ups that stay visible",
      "Conversations connected to the opportunity",
    ],
  },
};

export default function AuthMarketingPanel({
  variant,
}: {
  variant: AuthMarketingVariant;
}) {
  const copy = COPY[variant];

  return (
    <aside className="auth-marketing relative hidden h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--marketing-bg)] lg:flex">
      <div className="auth-marketing-halo pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden px-10 pb-0 pt-14 xl:px-14">
        <div className="max-w-[520px] shrink-0">
          <h2
            className="text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--marketing-text-heading)] xl:text-[38px]"
            style={{ fontWeight: 650 }}
          >
            {copy.headline}
          </h2>

          <p className="mt-2.5 max-w-[440px] text-[14px] leading-[1.5] text-[var(--marketing-text-secondary)]">
            {copy.support}
          </p>

          <ul className="mt-4 max-w-[420px] space-y-2">
            {copy.outcomes.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CircleCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-olive)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-[13px] leading-snug text-[var(--marketing-text-label)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Fills leftover viewport only — clipped, never grows the page */}
        <div className="auth-product-stage relative mt-5 min-h-0 flex-1 overflow-hidden">
          <div className="auth-product-frame absolute inset-0 overflow-hidden">
            <div className="auth-product-preview absolute left-0 top-0 w-[min(100%,520px)] origin-top-left scale-[0.72] xl:scale-[0.78]">
              <ProductHeroVisual />
            </div>
            <div className="auth-product-fade pointer-events-none absolute inset-x-0 bottom-0 h-16" aria-hidden />
          </div>
        </div>
      </div>
    </aside>
  );
}
