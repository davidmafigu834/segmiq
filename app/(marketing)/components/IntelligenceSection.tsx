export function IntelligenceSection() {
  return (
    <section
      id="intelligence"
      className="bg-[#F0EEE8] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10"
    >
      <div className="max-w-[1100px] mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/35 mb-3">
          AI intelligence
        </p>
        <h2 className="text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold text-[#111] leading-[1.1] tracking-tight mb-4">
          Every lead processed by AI{' '}
          <span className="bg-[#D4FF4F] px-1">before the first call</span>
        </h2>
        <p className="text-[16px] text-black/45 leading-[1.75] max-w-[500px] mb-12 sm:mb-16">
          Intent classified. Budget estimated. Urgency detected. Tags
          applied. Salespeople walk into every call knowing exactly what
          the prospect wants and how serious they are.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* Left column */}
          <div className="flex flex-col gap-4">

            {/* Intent score card */}
            <div className="bg-white border border-black/[0.06] rounded-[16px] p-6 sm:p-7">
              <div className="flex items-center gap-5 mb-5">
                <div className="bg-[#111] rounded-[12px] px-4 py-2.5 flex-shrink-0">
                  <span
                    className="text-[48px] font-extrabold text-[#D4FF4F] leading-none tracking-[-2px]"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    82
                  </span>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#111] mb-1">Intent score</p>
                  <p className="text-[12px] text-black/45 leading-[1.55]">
                    Scored at submission based on specificity,
                    urgency, budget, and decision maker signal.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Immediate urgency', bg: 'bg-orange-50 text-orange-700 border-orange-100' },
                  { label: 'Decision maker', bg: 'bg-green-50 text-green-700 border-green-100' },
                  { label: 'Budget confirmed', bg: 'bg-blue-50 text-blue-700 border-blue-100' },
                  { label: 'Comparing quotes', bg: 'bg-purple-50 text-purple-700 border-purple-100' },
                ].map(tag => (
                  <span
                    key={tag.label}
                    className={`px-3 py-1.5 border rounded-full text-[11px] font-bold ${tag.bg}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Intent categories */}
            <div className="bg-white border border-black/[0.06] rounded-[16px] p-6 sm:p-7">
              <h3 className="text-[15px] font-bold text-[#111] mb-1.5">Intent categories — this week</h3>
              <p className="text-[12px] text-black/45 mb-5 leading-[1.55]">
                Automatically classifies what every prospect wants.
              </p>
              {[
                { label: 'Residential solar', count: 31, pct: 88, colour: '#D4FF4F' },
                { label: 'Commercial roofing', count: 12, pct: 40, colour: '#60a5fa' },
                { label: 'New build', count: 8, pct: 28, colour: '#a78bfa' },
                { label: 'Battery backup', count: 5, pct: 18, colour: '#3dd68c' },
              ].map(bar => (
                <div key={bar.label} className="flex items-center gap-3 mb-3 last:mb-0">
                  <span className="text-[11px] text-black/45 w-[130px] flex-shrink-0 truncate">
                    {bar.label}
                  </span>
                  <div className="flex-1 h-[5px] bg-black/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-[5px] rounded-full"
                      style={{ width: `${bar.pct}%`, background: bar.colour }}
                    />
                  </div>
                  <span
                    className="text-[14px] font-bold text-[#111] w-[24px] text-right flex-shrink-0"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {bar.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — recommendations */}
          <div className="bg-white border border-black/[0.06] rounded-[16px] p-6 sm:p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/35 mb-2">
              Performance recommendations
            </p>
            <h3 className="text-[20px] font-bold text-[#111] mb-2 leading-snug">
              The platform tells you exactly what to fix
            </h3>
            <p className="text-[13px] text-black/45 leading-[1.6] mb-6">
              Not generic advice. Exact numbers, exact problems, exact
              actions — generated daily from your data.
            </p>
            <div className="flex flex-col gap-3">
              {[
                {
                  level: 'Critical',
                  levelColour: 'text-orange-700',
                  bg: 'bg-orange-50 border-orange-100',
                  text: 'Average response time is 4.2h. Leads called within 1 hour convert at 3× the rate. Set a 30-minute call rule.',
                  textColour: 'text-orange-900',
                },
                {
                  level: 'High',
                  levelColour: 'text-amber-700',
                  bg: 'bg-amber-50 border-amber-100',
                  text: 'Referral leads have a 68% contact rate vs Facebook at 12%. Reallocate 20% of budget to a referral incentive.',
                  textColour: 'text-amber-900',
                },
                {
                  level: 'Medium',
                  levelColour: 'text-blue-700',
                  bg: 'bg-blue-50 border-blue-100',
                  text: 'Only 38% of leads have a follow-up date set. Every call must end with a next step scheduled in the platform.',
                  textColour: 'text-blue-900',
                },
                {
                  level: 'Insight',
                  levelColour: 'text-green-700',
                  bg: 'bg-green-50 border-green-100',
                  text: 'Leads who received a pricing package converted at 3× those who didn\'t. Assets sent to only 22% of leads this week.',
                  textColour: 'text-green-900',
                },
              ].map(rec => (
                <div
                  key={rec.level}
                  className={`border rounded-[10px] p-4 ${rec.bg}`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-1.5 ${rec.levelColour}`}>
                    {rec.level}
                  </p>
                  <p className={`text-[12px] leading-[1.6] ${rec.textColour}`}>
                    {rec.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
