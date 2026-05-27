import Link from 'next/link';

const PLANS = [
  {
    name: 'Starter',
    price: '$99',
    desc: 'Everything a small team needs to stop losing leads and move faster.',
    popular: false,
    features: [
      { text: 'Lead management and pipeline', included: true },
      { text: 'Conversational lead form', included: true },
      { text: 'WhatsApp notifications', included: true },
      { text: 'One-tap send panel', included: true },
      { text: 'Call logging and timeline', included: true },
      { text: 'Up to 5 salespeople', included: true },
      { text: 'AI lead intelligence', included: false },
      { text: 'Audience CSV exports', included: false },
      { text: 'Performance recommendations', included: false },
    ],
  },
  {
    name: 'Growth',
    price: '$199',
    desc: 'For established teams that want AI intelligence and Facebook retargeting.',
    popular: true,
    features: [
      { text: 'Everything in Starter', included: true },
      { text: 'AI lead intelligence', included: true },
      { text: 'Daily AI coaching on WhatsApp', included: true },
      { text: 'Lead scoring and stale alerts', included: true },
      { text: 'Audience segment exports', included: true },
      { text: 'Win analysis', included: true },
      { text: 'Up to 15 salespeople', included: true },
      { text: 'Performance recommendations', included: false },
    ],
  },
  {
    name: 'Scale',
    price: '$349',
    desc: 'For operators with active ad spend who want the full intelligence layer.',
    popular: false,
    features: [
      { text: 'Everything in Growth', included: true },
      { text: 'Performance recommendations', included: true },
      { text: 'Weekly performance trends', included: true },
      { text: 'Source performance analysis', included: true },
      { text: 'Custom audience segments', included: true },
      { text: 'Unlimited salespeople', included: true },
      { text: 'Priority agency support', included: true },
    ],
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="bg-[#F8F7F4] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10"
    >
      <div className="max-w-[1100px] mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/35 mb-3">
          Pricing
        </p>
        <h2 className="text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold text-[#111] leading-[1.1] tracking-tight mb-4">
          Simple pricing.{' '}
          <span className="bg-[#D4FF4F] px-1">One deal pays for the year.</span>
        </h2>
        <p className="text-[16px] text-black/45 leading-[1.75] max-w-[440px] mb-12 sm:mb-16">
          Per client per month. No setup fees. No long contracts. Cancel
          anytime.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-[20px] p-7 sm:p-8 flex flex-col ${
                plan.popular
                  ? 'border-[1.5px] border-[#111] shadow-lg'
                  : 'border border-black/[0.08]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-[#111] text-[#D4FF4F] text-[10px] font-bold px-4 py-1 rounded-full tracking-[0.06em] whitespace-nowrap">
                  Most popular
                </div>
              )}

              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/35 mb-3">
                {plan.name}
              </p>
              <p
                className="text-[44px] font-extrabold text-[#111] tracking-[-1.5px] leading-none mb-1"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {plan.price}
                <span className="text-[15px] font-normal text-black/35 tracking-normal ml-1">
                  /mo per client
                </span>
              </p>
              <p className="text-[13px] text-black/40 leading-[1.55] mt-3 mb-5">
                {plan.desc}
              </p>
              <div className="h-px bg-black/[0.07] mb-5" />

              <div className="flex flex-col gap-2.5 mb-7 flex-1">
                {plan.features.map(feat => (
                  <div
                    key={feat.text}
                    className={`flex items-start gap-2.5 text-[12px] leading-snug ${
                      feat.included ? 'text-black/55' : 'text-black/22'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 mt-0.5 text-[14px] ${
                        feat.included ? 'text-[#3dd68c]' : 'text-black/20'
                      }`}
                    >
                      {feat.included ? '✓' : '–'}
                    </span>
                    {feat.text}
                  </div>
                ))}
              </div>

              <Link
                href="/login"
                className={`flex items-center justify-center h-[44px] w-full rounded-[10px] text-[13px] font-bold transition-all duration-150 ${
                  plan.popular
                    ? 'bg-[#111] text-[#D4FF4F] hover:bg-[#222]'
                    : 'bg-transparent border border-black/15 text-[#111] hover:border-black/30 hover:bg-black/[0.03]'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
