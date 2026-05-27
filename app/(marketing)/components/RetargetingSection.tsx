export function RetargetingSection() {
  const audiences = [
    { emoji: '🏆', name: 'Won customers', desc: 'Build a lookalike — find more people like your buyers', count: '247', colour: 'text-[#3dd68c]', iconBg: 'bg-[#3dd68c]/10' },
    { emoji: '📞', name: 'Contacted — did not convert', desc: 'Warm leads who answered. Retarget with an offer.', count: '1,284', colour: 'text-[#60a5fa]', iconBg: 'bg-[#60a5fa]/10' },
    { emoji: '📵', name: 'Never answered', desc: 'Exclude from campaigns to cut wasted spend', count: '892', colour: 'text-[#ff6b6b]', iconBg: 'bg-[#ff6b6b]/10' },
    { emoji: '💰', name: 'High budget — not converted', desc: 'Had money and intent. High-value retarget audience.', count: '183', colour: 'text-[#f5a623]', iconBg: 'bg-[#f5a623]/10' },
    { emoji: '⚡', name: 'Immediate urgency leads', desc: 'Need it now — retarget before a competitor gets them', count: '96', colour: 'text-[#D4FF4F]', iconBg: 'bg-[#D4FF4F]/10' },
  ];

  const steps = [
    { title: 'Choose your segment in Segmiq', desc: 'Won customers, warm leads, high budget — pick the audience that matches your campaign goal.' },
    { title: 'Click Export CSV', desc: 'One click downloads a Meta-compatible file with phone, email, and name — formatted exactly as Meta expects.' },
    { title: 'Upload to Meta Ads Manager', desc: 'Audiences → Create Audience → Customer List. Upload the file. Meta matches your contacts.' },
    { title: 'Build a lookalike from your buyers', desc: 'Create a 1% lookalike from Won Customers. Facebook finds people who look exactly like the people who already paid you.' },
  ];

  return (
    <section
      id="audiences"
      className="bg-[#0A0A14] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10"
    >
      <div className="max-w-[1100px] mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/30 mb-3">
          Facebook retargeting
        </p>
        <h2 className="text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold text-white leading-[1.1] tracking-tight mb-4">
          Turn your customers into{' '}
          <span className="text-[#D4FF4F]">your best ad audience</span>
        </h2>
        <p className="text-[16px] text-white/40 leading-[1.75] max-w-[500px] mb-12 sm:mb-16">
          One click exports a Meta-compatible CSV of your actual buyers,
          warm leads, and high-intent prospects. Upload to Facebook and
          your targeting immediately improves.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">

          {/* Audience segment cards */}
          <div className="flex flex-col gap-3">
            {audiences.map(aud => (
              <div
                key={aud.name}
                className="bg-[#111827] border border-white/[0.07] rounded-[14px] px-4 py-4 flex items-center gap-4 hover:border-white/15 transition-colors duration-200"
              >
                <div
                  className={`w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[20px] flex-shrink-0 ${aud.iconBg}`}
                  aria-hidden="true"
                >
                  {aud.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white/90 mb-0.5 truncate">{aud.name}</p>
                  <p className="text-[11px] text-white/35 leading-[1.4]">{aud.desc}</p>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <p
                    className={`text-[22px] font-extrabold leading-none ${aud.colour}`}
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {aud.count}
                  </p>
                  <p className="text-[10px] text-white/25 mt-1">↓ Export CSV</p>
                </div>
              </div>
            ))}
          </div>

          {/* Step-by-step flow */}
          <div className="bg-[#111827] border border-white/[0.07] rounded-[18px] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-[36px] h-[36px] rounded-[10px] bg-[#1877F2]/15 border border-[#1877F2]/25 flex items-center justify-center text-[16px]"
                aria-hidden="true"
              >
                📘
              </div>
              <p className="text-[14px] font-bold text-white/90">
                How it connects to Meta Ads
              </p>
            </div>

            <div className="flex flex-col gap-0">
              {steps.map((step, i) => (
                <div key={step.title}>
                  <div className="flex items-start gap-4">
                    <div className="w-[28px] h-[28px] rounded-full bg-[#D4FF4F] flex items-center justify-center text-[11px] font-extrabold text-black flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="pb-5">
                      <p className="text-[13px] font-bold text-white/90 mb-1.5">
                        {step.title}
                      </p>
                      <p className="text-[12px] text-white/35 leading-[1.6]">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-[2px] h-[16px] bg-[#D4FF4F]/20 ml-[13px] mb-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2.5 px-4 py-3 bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-[10px]">
              <span className="text-[16px]" aria-hidden="true">📘</span>
              <p className="text-[12px] font-bold text-[#6fa8f5]">
                Meta Ads Manager compatible — uploads in under 2 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
